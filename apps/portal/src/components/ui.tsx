import type { FulfilmentStatus, OrderState, PaymentStatus } from '@/lib/gateway';

const PAY: Record<PaymentStatus, [string, string]> = {
  pending: ['Payment pending', 'warn'], authorised: ['Authorised', 'info'], paid: ['Paid', 'ok'], failed: ['Payment failed', 'bad'],
  partially_refunded: ['Partly refunded', 'info'], refunded: ['Refunded', ''], disputed: ['Disputed', 'bad'],
};
const FUL: Record<FulfilmentStatus, [string, string]> = { unfulfilled: ['To fulfil', 'warn'], partial: ['Part shipped', 'info'], fulfilled: ['Fulfilled', 'ok'], returned: ['Returned', ''] };

export const PayBadge = ({ s }: { s: PaymentStatus }) => <span className={`badge ${PAY[s][1]}`}>{PAY[s][0]}</span>;
export const FulBadge = ({ s, state }: { s: FulfilmentStatus; state: OrderState }) =>
  state === 'cancelled' ? <span className="badge">Cancelled</span> : <span className={`badge ${FUL[s][1]}`}>{FUL[s][0]}</span>;

export function Header({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <div className="ph"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>{children && <div className="acts">{children}</div>}</div>;
}

const TONES = ['', 'b', 'l', 'p'];
export const initials = (n: string) => n.split(' ').map(x => x[0]).slice(0, 2).join('');
export const Avatar = ({ name, i = 0 }: { name: string; i?: number }) => <span className={`av ${TONES[i % 4]}`} aria-hidden>{initials(name)}</span>;
