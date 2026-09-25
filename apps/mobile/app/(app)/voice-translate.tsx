import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import type { Voice } from 'expo-speech';
import {
  TRANSLATE_LANGUAGE_LABELS,
  TRANSLATE_LANGUAGE_OPTIONS,
  type TranslateLanguage,
} from '@sessionai/shared';
import { SessionNavHeaderLeft } from '@/src/components/SessionNavHeaderLeft';
import { SelectField, SelectSheet, type SelectOption } from '@/src/components/SelectSheet';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import { consumeFeature } from '@/src/services/entitlements';
import { ensureFeatureAccess } from '@/src/utils/feature-gate';
import {
  asTranslateLanguage,
  speechLocaleForCode,
  speechLocaleForLanguage,
  translateVoiceClip,
  voiceMatchesLanguage,
} from '@/src/services/voice-translate';
import {
  archiveConversation,
  conversationPreview,
  createEmptyConversation,
  deleteHistoryConversation,
  formatConversationForShare,
  getPreferredVoiceId,
  listConversationHistory,
  loadActiveConversation,
  restoreHistoryConversation,
  saveActiveConversation,
  setPreferredVoiceId,
  startNewConversation,
  type VoiceTranslateConversation,
  type VoiceTranslateTurn,
} from '@/src/services/voice-translate-conversation';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import { gradients, radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction, showAlert } from '@/src/utils/confirm';
import { formatRelativeSessionDate } from '@/src/utils/format';

type Phase = 'idle' | 'recording' | 'processing' | 'ready';
type PickerKind = 'source' | 'target' | 'voice' | null;

const MIN_CLIP_MS = 700;

const SOURCE_OPTIONS: Array<SelectOption> = [
  { value: 'auto', label: 'Auto-detect', hint: 'Let Whisper guess the spoken language' },
  ...TRANSLATE_LANGUAGE_OPTIONS.map((o) => ({
    value: o.code,
    label: o.label,
    hint: o.code,
  })),
];

const TARGET_OPTIONS: Array<SelectOption<TranslateLanguage>> = TRANSLATE_LANGUAGE_OPTIONS.map(
  (o) => ({
    value: o.code,
    label: o.label,
    hint: o.code,
  }),
);

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
};

/** All device voices, with ones matching the target language listed first. */
function sortVoicesForTarget(voices: Voice[], target: TranslateLanguage): Voice[] {
  return [...voices].sort((a, b) => {
    const aMatch = voiceMatchesLanguage(a.language, target, a.name) ? 0 : 1;
    const bMatch = voiceMatchesLanguage(b.language, target, b.name) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.name.localeCompare(b.name);
  });
}

function pickVoiceForTarget(voices: Voice[], target: TranslateLanguage): Voice | null {
  return (
    voices.find((v) => voiceMatchesLanguage(v.language, target, v.name)) ?? null
  );
}

function newTurnId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isNoSpeechError(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.code === 'VALIDATION_ERROR' &&
    (msg.includes('could not hear') ||
      msg.includes('no speech') ||
      msg.includes('closer to the mic') ||
      msg.includes('hear speech'))
  );
}

export default function VoiceTranslateScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const tabBarInset = useFloatingTabBarContentInset();
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const threadRef = useRef<ScrollView>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState<TranslateLanguage>('en');
  const [phase, setPhase] = useState<Phase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [hardError, setHardError] = useState<string | null>(null);
  const [turns, setTurns] = useState<VoiceTranslateTurn[]>([]);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<VoiceTranslateConversation[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [picker, setPicker] = useState<PickerKind>(null);

  const holdRef = useRef(false);
  const recordingRef = useRef(false);
  const processGen = useRef(0);
  const voiceIdRef = useRef<string | null>(null);
  const conversationRef = useRef<VoiceTranslateConversation | null>(null);

  const sortedVoices = useMemo(
    () => sortVoicesForTarget(voices, targetLang),
    [voices, targetLang],
  );

  function applyConversation(convo: VoiceTranslateConversation) {
    conversationRef.current = convo;
    setConversationId(convo.id);
    setTurns(convo.turns);
    setSourceLang(convo.sourceLang);
    setTargetLang(convo.targetLang);
  }

  async function refreshHistory() {
    setHistory(await listConversationHistory());
  }

  useEffect(() => {
    voiceIdRef.current = voiceId;
  }, [voiceId]);

  useEffect(() => {
    void (async () => {
      const [savedVoice, active, available] = await Promise.all([
        getPreferredVoiceId(),
        loadActiveConversation(),
        Speech.getAvailableVoicesAsync().catch(() => [] as Voice[]),
      ]);
      setVoices(available);
      setVoiceId(savedVoice);
      if (active && active.turns.length > 0) {
        applyConversation(active);
        setGateOpen(true);
      } else if (active) {
        applyConversation(active);
      } else {
        const fresh = createEmptyConversation();
        applyConversation(fresh);
        await saveActiveConversation(fresh);
      }
      await refreshHistory();
      setBootReady(true);
    })();
    return () => {
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!bootReady || !conversationId || gateOpen) return;
    const next: VoiceTranslateConversation = {
      id: conversationId,
      turns,
      sourceLang,
      targetLang,
      createdAt: conversationRef.current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    conversationRef.current = next;
    void saveActiveConversation(next);
  }, [turns, sourceLang, targetLang, bootReady, conversationId, gateOpen]);

  // When Phone says changes, auto-select a matching device voice (if one exists).
  useEffect(() => {
    if (!bootReady || !voices.length) return;
    const current = voiceId ? voices.find((v) => v.identifier === voiceId) : null;
    if (current && voiceMatchesLanguage(current.language, targetLang, current.name)) {
      return;
    }

    const preferred = pickVoiceForTarget(voices, targetLang);
    if (!preferred) return;
    setVoiceId(preferred.identifier);
    void setPreferredVoiceId(preferred.identifier);
  }, [targetLang, voices, bootReady, voiceId]);
  useEffect(() => {
    if (turns.length === 0) return;
    const t = setTimeout(() => {
      threadRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [turns.length, phase]);

  async function ensureMic(): Promise<boolean> {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setHardError('Microphone permission is required.');
      return false;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    return true;
  }

  async function startHold() {
    if (phase === 'processing' || phase === 'recording') return;
    if (!(await ensureFeatureAccess('voiceTranslate', router, { voiceConversationId: conversationId }))) {
      return;
    }
    holdRef.current = true;
    setHardError(null);
    setNotice(null);
    void Speech.stop();
    setSpeakingTurnId(null);

    if (!(await ensureMic())) return;
    if (!holdRef.current) return;

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setPhase('recording');
    } catch {
      recordingRef.current = false;
      setHardError('Could not start the microphone. Try again.');
      setPhase('idle');
    }
  }

  async function endHold() {
    holdRef.current = false;
    if (!recordingRef.current) return;
    recordingRef.current = false;

    const durationMs = recorderState.durationMillis ?? 0;
    setPhase('processing');
    const gen = ++processGen.current;

    try {
      await recorder.stop();

      if (durationMs < MIN_CLIP_MS) {
        setNotice("Didn't catch that — hold a bit longer and try again.");
        setPhase('idle');
        return;
      }

      const uri = recorder.uri;
      if (!uri) {
        setNotice("Didn't catch that — no audio was captured.");
        setPhase('idle');
        return;
      }

      const result = await translateVoiceClip({
        localUri: uri,
        targetLanguage: targetLang,
        sourceLanguage: sourceLang === 'auto' ? undefined : sourceLang,
      });

      if (gen !== processGen.current) return;

      const source = result.sourceText.trim();
      const translated = result.translatedText.trim();
      if (!source || !translated) {
        setNotice("Didn't catch what you said — try speaking a little clearer.");
        setPhase('idle');
        return;
      }

      const turn: VoiceTranslateTurn = {
        id: newTurnId(),
        sourceText: source,
        translatedText: translated,
        sourceLanguage:
          sourceLang !== 'auto'
            ? sourceLang
            : result.detectedLanguage?.trim() || undefined,
        targetLanguage: result.targetLanguage,
        createdAt: new Date().toISOString(),
      };
      setTurns((prev) => [...prev, turn]);
      if (conversationId) {
        await consumeFeature('voiceTranslate', { voiceConversationId: conversationId });
      }
      setNotice(null);
      setPhase('ready');
      speakTranslation(turn);
    } catch (err) {
      if (gen !== processGen.current) return;
      if (isNoSpeechError(err)) {
        setNotice("Didn't catch what you said — try again closer to the mic.");
        setPhase('idle');
        return;
      }
      setHardError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Voice translate failed.',
      );
      setPhase('idle');
    }
  }

  function speakKey(turnId: string, side: 'source' | 'translation') {
    return `${turnId}:${side}`;
  }

  function speakSource(turn: VoiceTranslateTurn) {
    void Speech.stop();
    const key = speakKey(turn.id, 'source');
    setSpeakingTurnId(key);
    const code = turn.sourceLanguage ?? sourceLang;
    const known = asTranslateLanguage(code);
    const voice =
      (known
        ? voices.find((v) => voiceMatchesLanguage(v.language, known, v.name))
        : null) ?? null;
    Speech.speak(turn.sourceText, {
      language: speechLocaleForCode(code),
      voice: voice?.identifier,
      rate: 0.96,
      onDone: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
      onStopped: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
      onError: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
    });
  }

  function speakTranslation(turn: VoiceTranslateTurn) {
    void Speech.stop();
    const key = speakKey(turn.id, 'translation');
    setSpeakingTurnId(key);
    Speech.speak(turn.translatedText, {
      language: speechLocaleForLanguage(turn.targetLanguage),
      voice: voiceIdRef.current ?? undefined,
      rate: 0.96,
      onDone: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
      onStopped: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
      onError: () => setSpeakingTurnId((cur) => (cur === key ? null : cur)),
    });
  }

  function stopSpeaking() {
    void Speech.stop();
    setSpeakingTurnId(null);
  }

  async function onPickVoice(nextId: string) {
    const id = nextId || null;
    setVoiceId(id);
    await setPreferredVoiceId(id);
  }

  async function onContinueConversation() {
    setGateOpen(false);
  }

  async function onStartNewFromGate() {
    stopSpeaking();
    if (!(await ensureFeatureAccess('voiceTranslate', router))) {
      setGateOpen(false);
      return;
    }
    const fresh = await startNewConversation(conversationRef.current, sourceLang, targetLang);
    applyConversation(fresh);
    await refreshHistory();
    setGateOpen(false);
  }

  async function onOpenHistory() {
    await refreshHistory();
    setHistoryOpen(true);
  }

  async function onRestoreHistory(id: string) {
    stopSpeaking();
    const restored = await restoreHistoryConversation(id, conversationRef.current);
    if (!restored) {
      await showAlert('Not found', 'That conversation is no longer in history.');
      await refreshHistory();
      return;
    }
    applyConversation(restored);
    await refreshHistory();
    setHistoryOpen(false);
    setGateOpen(false);
  }

  async function onDeleteHistory(id: string) {
    const ok = await confirmAction(
      'Delete conversation?',
      'This permanently removes it from history.',
      'Delete',
      { destructive: true },
    );
    if (!ok) return;
    await deleteHistoryConversation(id);
    await refreshHistory();
  }

  async function onClearConversation() {
    if (turns.length === 0) return;
    const ok = await confirmAction(
      'Archive & clear?',
      'This conversation moves to History so you can open it later.',
      'Archive',
    );
    if (!ok) return;
    if (!(await ensureFeatureAccess('voiceTranslate', router))) {
      return;
    }
    stopSpeaking();
    if (conversationRef.current) {
      await archiveConversation(conversationRef.current);
    }
    const fresh = createEmptyConversation(sourceLang, targetLang);
    applyConversation(fresh);
    await saveActiveConversation(fresh);
    await refreshHistory();
  }

  async function onSaveConversation() {
    if (turns.length === 0) {
      await showAlert('Nothing to save', 'Hold the mic and add at least one turn first.');
      return;
    }
    try {
      await Share.share({
        message: formatConversationForShare(turns),
        title: 'Voice translate conversation',
      });
    } catch {
      await showAlert('Could not share', 'Try again in a moment.');
    }
  }

  const seconds = Math.floor((recorderState.durationMillis ?? 0) / 1000);
  const timerLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const selectedVoiceName =
    sortedVoices.find((v) => v.identifier === voiceId)?.name ?? 'System default';
  const sourceLabel =
    SOURCE_OPTIONS.find((o) => o.value === sourceLang)?.label ?? sourceLang;

  const voiceOptions: Array<SelectOption> = useMemo(() => {
    if (sortedVoices.length === 0) {
      return [{ value: '__default__', label: 'System default' }];
    }
    return sortedVoices.map((v) => {
      const match = voiceMatchesLanguage(v.language, targetLang, v.name);
      return {
        value: v.identifier,
        label: v.name,
        hint: match ? `${v.language} · matches Phone says` : v.language,
      };
    });
  }, [sortedVoices, targetLang]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Voice translate',
          headerBackVisible: false,
          headerLeft: () => <SessionNavHeaderLeft />,
        }}
      />

      {/* Language summary + tools */}
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setSettingsOpen((v) => !v)}
          style={[
            styles.pairCard,
            {
              backgroundColor: colors.surface,
              borderColor: settingsOpen ? colors.brand + '66' : colors.border,
            },
            shadows.soft,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Language and voice settings"
        >
          <View style={styles.langCol}>
            <Text style={[styles.langLabel, { color: colors.inkMuted }]}>They speak</Text>
            <Text style={[styles.langValue, { color: colors.ink }]} numberOfLines={1}>
              {sourceLabel}
            </Text>
          </View>
          <View style={[styles.swapGlyph, { backgroundColor: colors.accentSoft }]}>
            <Icon name="translate" size={16} color={colors.brand} />
          </View>
          <View style={[styles.langCol, styles.langColEnd]}>
            <Text style={[styles.langLabel, { color: colors.inkMuted }]}>Phone says</Text>
            <Text style={[styles.langValue, { color: colors.cyan }]} numberOfLines={1}>
              {TRANSLATE_LANGUAGE_LABELS[targetLang]}
            </Text>
          </View>
          <View style={{ transform: [{ rotate: settingsOpen ? '-90deg' : '90deg' }] }}>
            <Icon name="chevron-right" size={16} color={colors.inkMuted} variant="line" />
          </View>
        </Pressable>

        <View style={styles.toolRow}>
          <Pressable
            onPress={() => void onOpenHistory()}
            hitSlop={2}
            style={[
              styles.toolBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Conversation history"
          >
            <Icon name="chat" size={18} color={colors.brand} variant="line" />
          </Pressable>
          <Pressable
            onPress={() => void onSaveConversation()}
            disabled={turns.length === 0}
            hitSlop={2}
            style={[
              styles.toolBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: turns.length === 0 ? 0.4 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Share conversation"
          >
            <Icon name="share-variant-outline" size={18} color={colors.brand} variant="line" />
          </Pressable>
          <Pressable
            onPress={() => void onClearConversation()}
            disabled={turns.length === 0}
            hitSlop={2}
            style={[
              styles.toolBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: turns.length === 0 ? 0.4 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Archive and clear conversation"
          >
            <Icon name="trash-can-outline" size={18} color={colors.danger} variant="line" />
          </Pressable>
        </View>
      </View>

      {settingsOpen ? (
        <View
          style={[
            styles.settingsPanel,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <SelectField
            label="They speak"
            valueLabel={sourceLabel}
            onPress={() => setPicker('source')}
          />
          <SelectField
            label="Phone says"
            valueLabel={TRANSLATE_LANGUAGE_LABELS[targetLang]}
            onPress={() => setPicker('target')}
            accent={colors.cyan}
          />
          <SelectField
            label="Translator voice"
            valueLabel={selectedVoiceName}
            onPress={() => setPicker('voice')}
            accent={colors.brandSoft}
          />
          <Text style={[styles.voiceMeta, { color: colors.inkMuted }]}>
            {TARGET_OPTIONS.length} languages · {sortedVoices.length || 1} voices on this device
          </Text>
        </View>
      ) : null}

      <SelectSheet
        visible={picker === 'source'}
        title="They speak"
        subtitle="Language the other person is speaking"
        options={SOURCE_OPTIONS}
        value={sourceLang}
        searchPlaceholder="Search languages"
        onClose={() => setPicker(null)}
        onSelect={setSourceLang}
      />
      <SelectSheet
        visible={picker === 'target'}
        title="Phone says"
        subtitle="Language your phone should speak"
        options={TARGET_OPTIONS}
        value={targetLang}
        searchPlaceholder="Search languages"
        onClose={() => setPicker(null)}
        onSelect={(next) => {
          setHardError(null);
          setTargetLang(next);
          const preferred = pickVoiceForTarget(voices, next);
          if (preferred) {
            setVoiceId(preferred.identifier);
            void setPreferredVoiceId(preferred.identifier);
          }
        }}
      />
      <SelectSheet
        visible={picker === 'voice'}
        title="Translator voice"
        subtitle="All voices installed on your phone — matching languages listed first"
        options={voiceOptions}
        value={voiceId ?? '__default__'}
        searchPlaceholder="Search voices"
        onClose={() => setPicker(null)}
        onSelect={(next) => {
          if (next === '__default__') {
            void onPickVoice('');
            return;
          }
          void onPickVoice(next);
        }}
      />

      {/* Conversation */}
      <View style={[styles.threadWrap, { backgroundColor: colors.surface }]}>
        <Text style={[styles.threadTitle, { color: colors.inkMuted }]}>
          {turns.length === 0 ? 'Conversation' : `Conversation · ${turns.length}`}
        </Text>
        <ScrollView
          ref={threadRef}
          style={styles.thread}
          contentContainerStyle={[
            styles.threadContent,
            turns.length === 0 && styles.threadEmptyPad,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {turns.length === 0 ? (
            <View style={styles.emptyBlock}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon name="translate" size={28} color={colors.brand} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>Ready when you are</Text>
              <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
                Hold the mic, speak a sentence, then release. Turns stack here so you can save the
                whole chat later.
              </Text>
            </View>
          ) : (
            turns.map((turn) => {
              const speakingSource = speakingTurnId === speakKey(turn.id, 'source');
              const speakingTranslation =
                speakingTurnId === speakKey(turn.id, 'translation');
              return (
                <View key={turn.id} style={styles.turn}>
                  <View
                    style={[
                      styles.bubble,
                      styles.bubbleHeard,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                      shadows.soft,
                    ]}
                  >
                    <View style={styles.bubbleHeader}>
                      <Text style={[styles.bubbleLabel, { color: colors.inkMuted }]}>Speaker</Text>
                      <Pressable
                        onPress={() => (speakingSource ? stopSpeaking() : speakSource(turn))}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          speakingSource ? 'Stop speaking' : 'Speak original text'
                        }
                        style={[
                          styles.speakBtn,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Icon
                          name={speakingSource ? 'stop' : 'play'}
                          size={14}
                          color={colors.inkMuted}
                          variant="line"
                        />
                      </Pressable>
                    </View>
                    <Text style={[styles.bubbleBody, { color: colors.ink }]}>{turn.sourceText}</Text>
                  </View>
                  <View
                    style={[
                      styles.bubble,
                      styles.bubbleTranslated,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.cyan + '40',
                      },
                      shadows.soft,
                    ]}
                  >
                    <LinearGradient
                      colors={['rgba(74, 108, 247, 0.10)', 'rgba(56, 189, 248, 0.08)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.bubbleHeader}>
                      <Text style={[styles.bubbleLabel, { color: colors.cyan }]}>Translation</Text>
                      <Pressable
                        onPress={() =>
                          speakingTranslation ? stopSpeaking() : speakTranslation(turn)
                        }
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          speakingTranslation ? 'Stop speaking' : 'Speak translation'
                        }
                        style={[
                          styles.speakBtn,
                          { backgroundColor: colors.actionImport, borderColor: colors.cyan + '55' },
                        ]}
                      >
                        <Icon
                          name={speakingTranslation ? 'stop' : 'play'}
                          size={14}
                          color={colors.cyan}
                          variant="line"
                        />
                      </Pressable>
                    </View>
                    <Text style={[styles.bubbleBody, { color: colors.ink }]}>
                      {turn.translatedText}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Soft notice / hard error */}
      {notice ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.accentSoft, borderColor: colors.brand + '44' },
          ]}
        >
          <Icon name="alert" size={16} color={colors.brand} variant="line" />
          <Text style={[styles.noticeText, { color: colors.ink }]}>{notice}</Text>
        </View>
      ) : null}
      {hardError ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: 'rgba(239, 68, 68, 0.10)', borderColor: colors.danger + '44' },
          ]}
        >
          <Icon name="alert" size={16} color={colors.danger} variant="line" />
          <Text style={[styles.noticeText, { color: colors.danger }]}>{hardError}</Text>
        </View>
      ) : null}

      {/* Mic dock */}
      <LinearGradient
        colors={[colors.background + '00', colors.background]}
        style={[styles.dockFade, { paddingBottom: Math.max(tabBarInset * 0.12, spacing.md) }]}
      >
        <Text
          style={[
            styles.timer,
            { color: phase === 'recording' ? colors.danger : colors.inkMuted },
          ]}
        >
          {phase === 'recording' ? timerLabel : phase === 'processing' ? 'Translating…' : '00:00'}
        </Text>

        <Pressable
          onPressIn={() => void startHold()}
          onPressOut={() => void endHold()}
          disabled={phase === 'processing'}
          style={({ pressed }) => [
            styles.micOuter,
            {
              opacity: phase === 'processing' ? 0.6 : 1,
              transform: [{ scale: phase === 'recording' ? 1.05 : pressed ? 0.97 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={phase === 'recording' ? 'Release to translate' : 'Hold to speak'}
        >
          <View
            style={[
              styles.micHalo,
              {
                backgroundColor:
                  phase === 'recording' ? colors.danger + '28' : colors.brand + '22',
              },
            ]}
          />
          <LinearGradient
            colors={
              phase === 'recording'
                ? ['#F87171', '#EF4444']
                : [...gradients.primary]
            }
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.micBtn, shadows.emboss]}
          >
            {phase === 'processing' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Icon name="microphone" size={32} color="#FFFFFF" variant="line" />
            )}
          </LinearGradient>
        </Pressable>

        <Text style={[styles.micHint, { color: colors.inkMuted }]}>
          {phase === 'recording'
            ? 'Release to translate'
            : phase === 'processing'
              ? 'Working…'
              : 'Hold to talk'}
        </Text>
      </LinearGradient>

      {/* Continue vs Start new */}
      <Modal visible={gateOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={[styles.gateBackdrop, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.gateCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.soft,
            ]}
          >
            <View style={[styles.gateIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="chat" size={28} color={colors.brand} />
            </View>
            <Text style={[styles.gateTitle, { color: colors.ink }]}>Continue conversation?</Text>
            <Text style={[styles.gateBody, { color: colors.inkMuted }]}>
              You have {turns.length} turn{turns.length === 1 ? '' : 's'} from last time. Start new
              archives that chat in History.
            </Text>
            <Pressable
              onPress={() => void onContinueConversation()}
              style={({ pressed }) => [
                styles.gatePrimary,
                { backgroundColor: colors.brand, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue previous conversation"
            >
              <Text style={styles.gatePrimaryText}>Continue previous</Text>
            </Pressable>
            <Pressable
              onPress={() => void onStartNewFromGate()}
              style={({ pressed }) => [
                styles.gateSecondary,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start a new conversation"
            >
              <Text style={[styles.gateSecondaryText, { color: colors.ink }]}>Start new</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* History */}
      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <Pressable
          style={[styles.gateBackdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setHistoryOpen(false)}
        >
          <Pressable
            style={[
              styles.historySheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: colors.ink }]}>History</Text>
              <Pressable
                onPress={() => setHistoryOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close history"
              >
                <Icon name="close" size={20} color={colors.inkMuted} variant="line" />
              </Pressable>
            </View>
            {history.length === 0 ? (
              <Text style={[styles.historyEmpty, { color: colors.inkMuted }]}>
                Archived conversations show up here when you start a new one.
              </Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {history.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyRow,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    <Pressable
                      style={styles.historyRowMain}
                      onPress={() => void onRestoreHistory(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open conversation from ${formatRelativeSessionDate(item.updatedAt)}`}
                    >
                      <Text style={[styles.historyPreview, { color: colors.ink }]} numberOfLines={2}>
                        {conversationPreview(item)}
                      </Text>
                      <Text style={[styles.historyMeta, { color: colors.inkMuted }]}>
                        {formatRelativeSessionDate(item.updatedAt)} · {item.turns.length} turn
                        {item.turns.length === 1 ? '' : 's'} ·{' '}
                        {TRANSLATE_LANGUAGE_LABELS[item.targetLang] ?? item.targetLang}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onDeleteHistory(item.id)}
                      hitSlop={8}
                      style={[styles.historyDelete, { backgroundColor: colors.surface }]}
                      accessibilityRole="button"
                      accessibilityLabel="Delete conversation"
                    >
                      <Icon name="trash-can-outline" size={16} color={colors.danger} variant="line" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  pairCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.smd,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  langCol: { flex: 1, gap: 2 },
  langColEnd: { alignItems: 'flex-end' },
  langLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  langValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  swapGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPanel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  voiceMeta: {
    ...typography.caption,
  },
  threadWrap: {
    flex: 1,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    overflow: 'hidden',
  },
  threadTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: spacing.sm,
  },
  thread: { flex: 1 },
  threadContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  threadEmptyPad: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
  },
  turn: { gap: spacing.sm },
  bubble: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 6,
    maxWidth: '90%',
    overflow: 'hidden',
  },
  bubbleHeard: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 8,
  },
  bubbleTranslated: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 8,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    zIndex: 1,
  },
  bubbleLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bubbleBody: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    zIndex: 1,
  },
  speakBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  dockFade: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  timer: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  micOuter: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micHalo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  gateBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  gateCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  gateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  gateBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  gatePrimary: {
    width: '100%',
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  gatePrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  gateSecondary: {
    width: '100%',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  gateSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  historySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  historyEmpty: {
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: spacing.lg,
  },
  historyList: {
    maxHeight: 420,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyRowMain: {
    flex: 1,
    gap: 4,
  },
  historyPreview: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
