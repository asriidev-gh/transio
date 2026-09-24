import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { useAuth } from '@/src/hooks/useAuth';
import { mobileEnv } from '@/src/lib/env';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { showAlert } from '@/src/utils/confirm';

type ContactMode = 'message' | 'bug';

function resolveMode(raw: string | string[] | undefined): ContactMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'bug' ? 'bug' : 'message';
}

export default function HelpContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = resolveMode(params.mode);
  const isBug = mode === 'bug';
  const { user } = useAuth();
  const { colors, shadows } = useTheme();
  const tabBarInset = useFloatingTabBarContentInset();
  const [subject, setSubject] = useState(isBug ? '[Bug] ' : '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  useEffect(() => {
    setSubject((prev) => {
      if (isBug && !prev.startsWith('[Bug]')) return `[Bug] ${prev}`.trim();
      if (!isBug && prev === '[Bug] ') return '';
      return prev;
    });
  }, [isBug]);

  const canSend = subject.trim().length > 0 && message.trim().length > 2;

  async function onSend() {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const deviceBits = [
        `App version: ${appVersion}`,
        `Platform: ${Platform.OS} ${String(Platform.Version)}`,
        user?.email ? `Account: ${user.email}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const footer = isBug
        ? `\n\n——\nBug report details\n${deviceBits}`
        : user?.email
          ? `\n\n— Sent from ${user.email}`
          : '';

      const body = `${message.trim()}${footer}`;
      const mailSubject = isBug
        ? subject.trim().startsWith('[Bug]')
          ? subject.trim()
          : `[Bug] ${subject.trim()}`
        : subject.trim();

      const url =
        `mailto:${encodeURIComponent(mobileEnv.supportEmail)}` +
        `?subject=${encodeURIComponent(mailSubject)}` +
        `&body=${encodeURIComponent(body)}`;

      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        await showAlert(
          'No mail app',
          `Email us at ${mobileEnv.supportEmail} and we’ll get back to you.`,
        );
        return;
      }
      await Linking.openURL(url);
      await showAlert(
        'Almost there',
        isBug
          ? 'Finish sending the bug report in your mail app. Thanks for flagging it.'
          : 'Finish sending in your mail app. We’ll reply by email.',
      );
      router.back();
    } catch {
      await showAlert(
        'Could not open mail',
        `Write to ${mobileEnv.supportEmail} and we’ll help from there.`,
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isBug ? 'Report a bug' : 'Send a message' }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lead, { color: colors.inkMuted }]}>
          {isBug
            ? 'What went wrong? Include steps to reproduce if you can — device details are added automatically.'
            : 'Tell us what’s going wrong. We read every message and reply by email.'}
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadows.soft,
          ]}
        >
          <Text style={[styles.label, { color: colors.inkMuted }]}>Subject</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={isBug ? 'e.g. Crash when opening a session' : 'e.g. Upload stuck on processing'}
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              {
                color: colors.ink,
                backgroundColor: colors.backgroundAlt,
                borderColor: colors.border,
              },
            ]}
            maxLength={120}
            returnKeyType="next"
            accessibilityLabel="Subject"
          />

          <Text style={[styles.label, { color: colors.inkMuted }]}>
            {isBug ? 'What happened' : 'Message'}
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={
              isBug
                ? '1. What you did\n2. What you expected\n3. What actually happened'
                : 'What happened? Include steps if you can.'
            }
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              styles.message,
              {
                color: colors.ink,
                backgroundColor: colors.backgroundAlt,
                borderColor: colors.border,
              },
            ]}
            multiline
            textAlignVertical="top"
            maxLength={4000}
            accessibilityLabel={isBug ? 'Bug details' : 'Message'}
          />

          <Text style={[styles.meta, { color: colors.inkMuted }]}>
            {isBug
              ? `Includes app ${appVersion} · ${Platform.OS} · ${mobileEnv.supportEmail}`
              : `Replies go to ${user?.email ?? 'your account email'} · ${mobileEnv.supportEmail}`}
          </Text>
        </View>

        <Button
          label={sending ? 'Opening mail…' : isBug ? 'Send bug report' : 'Send message'}
          onPress={() => void onSend()}
          disabled={!canSend}
          loading={sending}
          accessibilityLabel={isBug ? 'Send bug report' : 'Send message'}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  lead: {
    ...typography.body,
    lineHeight: 22,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.smd,
    fontSize: 15,
    minHeight: 48,
  },
  message: {
    minHeight: 160,
    paddingTop: spacing.smd,
  },
  meta: {
    ...typography.caption,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
