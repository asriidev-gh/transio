import { APP_NAME } from '@/src/data/brand';

export type SubscriptionPlanId = 'weekly' | 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  label: string;
  priceLabel: string;
  /** Short line under the price */
  detail: string;
  /** Badge e.g. Best value */
  badge?: string;
  /** For display math only until Store products are wired */
  priceUsd: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'weekly',
    label: 'Weekly',
    priceLabel: '$4.99',
    detail: 'Flexible · cancel anytime',
    priceUsd: 4.99,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    priceLabel: '$12.99',
    detail: 'Most popular',
    badge: 'Popular',
    priceUsd: 12.99,
  },
  {
    id: 'yearly',
    label: 'Yearly',
    priceLabel: '$79.99',
    detail: 'Save ~49% · $6.67/mo',
    badge: 'Best value',
    priceUsd: 79.99,
  },
];

export const FREE_TRIAL_COPY = {
  headline: `Try ${APP_NAME} free`,
  body: 'Recordings, AI Summaries, and Voice translate — unlock Pro when you’re ready for more.',
};
