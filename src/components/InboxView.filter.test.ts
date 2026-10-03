import { describe, expect, it } from 'vitest';

import { selectFilteredMessage } from './InboxView';
import type { InboxMessage } from '../store/useInboxStore';

const message = (id: string, category: InboxMessage['category']): InboxMessage => ({
  id,
  season: 1,
  week: 1,
  sender: 'test',
  title: id,
  content: id,
  isRead: false,
  category,
});

describe('InboxView filter fallback', () => {
  it('does not keep a selected message from another category', () => {
    const messages = [
      message('match-1', 'MATCH'),
      message('board-1', 'BOARD'),
    ];

    expect(selectFilteredMessage(messages, 'match-1', 'BOARD')?.id).toBe('board-1');
  });

  it('returns no message when the active filter is empty', () => {
    const messages = [message('match-1', 'MATCH')];

    expect(selectFilteredMessage(messages, 'match-1', 'BOARD')).toBeUndefined();
  });
});
