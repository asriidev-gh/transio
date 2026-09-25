import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  deriveMindMapFromSummary,
  type MindMapNode,
  type MindMapNodeKind,
  type MindMapSummaryInput,
} from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface MindMapViewProps {
  summary: MindMapSummaryInput;
  sessionTitle?: string;
}

function kindAccent(
  kind: MindMapNodeKind,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (kind) {
    case 'root':
      return colors.accent;
    case 'topic':
      return colors.accentDeep;
    case 'action':
      return colors.warning;
    case 'question':
      return colors.recording;
    case 'insight':
      return colors.accent;
    case 'keyPoint':
      return colors.inkMuted;
    case 'group':
    default:
      return colors.border;
  }
}

function NodeCard({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: MindMapNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: MindMapNode) => void;
}) {
  const { colors } = useTheme();
  const selected = selectedId === node.id;
  const accent = kindAccent(node.kind, colors);
  const isGroup = node.kind === 'group';

  return (
    <View style={styles.nodeBlock}>
      <View style={styles.nodeRow}>
        {depth > 0 ? (
          <View style={styles.connectorCol} accessibilityElementsHidden>
            <View style={[styles.connectorStem, { backgroundColor: colors.border }]} />
            <View style={[styles.connectorElbow, { borderColor: colors.border }]} />
          </View>
        ) : null}
        <Pressable
          onPress={() => onSelect(node)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`${node.kind}: ${node.label}`}
          style={[
            styles.node,
            isGroup && styles.groupNode,
            node.kind === 'root' && styles.rootNode,
            {
              backgroundColor: selected ? colors.accentSoft : colors.surface,
              borderColor: selected ? accent : colors.border,
            },
          ]}
        >
          {node.kind !== 'root' && node.kind !== 'group' ? (
            <View style={[styles.kindDot, { backgroundColor: accent }]} />
          ) : null}
          <Text
            style={[
              styles.nodeLabel,
              isGroup && styles.groupLabel,
              node.kind === 'root' && styles.rootLabel,
              { color: colors.ink },
            ]}
            numberOfLines={3}
          >
            {node.label}
          </Text>
        </Pressable>
      </View>

      {node.children.length > 0 ? (
        <View style={[styles.children, depth > 0 && styles.childrenIndent]}>
          {node.children.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function findNode(node: MindMapNode, id: string): MindMapNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function MindMapView({ summary, sessionTitle }: MindMapViewProps) {
  const { colors } = useTheme();
  const map = useMemo(
    () => deriveMindMapFromSummary(summary, { title: sessionTitle }),
    [summary, sessionTitle],
  );
  const [selectedId, setSelectedId] = useState<string | null>(map.root.id);
  const selected = selectedId ? findNode(map.root, selectedId) : null;

  const empty = map.root.children.length === 0 && !map.root.detail;

  return (
    <View style={styles.wrap} accessibilityLabel="Session mind map">
      <Text style={[styles.hint, { color: colors.inkMuted }]}>
        Tap a node to read details. Built from this session’s AI Summary.
      </Text>

      {empty ? (
        <Text style={[styles.empty, { color: colors.inkMuted }]}>
          Not enough summary content to build a map yet.
        </Text>
      ) : (
        <NodeCard
          node={map.root}
          depth={0}
          selectedId={selectedId}
          onSelect={(node) => setSelectedId(node.id)}
        />
      )}

      {selected?.detail ? (
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.detailLabel, { color: colors.inkMuted }]}>Detail</Text>
          <Text style={[styles.detailBody, { color: colors.ink }]} selectable>
            {selected.detail}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  hint: {
    ...typography.caption,
  },
  empty: {
    ...typography.body,
    paddingVertical: spacing.lg,
  },
  nodeBlock: {
    gap: spacing.sm,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  connectorCol: {
    width: 18,
    marginRight: 2,
  },
  connectorStem: {
    position: 'absolute',
    left: 7,
    top: 0,
    bottom: '50%',
    width: 2,
  },
  connectorElbow: {
    position: 'absolute',
    left: 7,
    top: '50%',
    width: 11,
    height: 2,
    borderTopWidth: 2,
  },
  node: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  rootNode: {
    borderWidth: 2,
  },
  groupNode: {
    borderStyle: 'dashed',
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  nodeLabel: {
    ...typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  rootLabel: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
  },
  groupLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  children: {
    gap: spacing.sm,
    marginLeft: spacing.sm,
    paddingLeft: spacing.sm,
  },
  childrenIndent: {
    marginLeft: spacing.md,
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  detailBody: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
});
