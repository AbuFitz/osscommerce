'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { deleteReviewAction, moderateReviewAction, replyToReviewAction } from '@/app/actions';
import type { Review } from '@/lib/gateway';

/** Approve, reject, reply or delete. Each says what actually happened, and nothing is deleted without asking. */
export function ReviewActions({ r }: { r: Review }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [reply, setReply] = useState(false); const [del, setDel] = useState(false); const [text, setText] = useState(r.reply ?? '');
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, done?: () => void) => start(async () => { const x = await fn(); toast(x.message, x.ok ? 'ok' : 'error'); if (x.ok) done?.(); });
  return (<>
    <div className="acts">
      {r.status !== 'approved' && <button className="btn sm primary" type="button" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, 'approved'))}>Approve</button>}
      {r.status !== 'rejected' && <button className="btn sm" type="button" disabled={pending} onClick={() => run(() => moderateReviewAction(r.id, 'rejected'))}>Reject</button>}
      {r.status === 'approved' && <button className="btn sm" type="button" disabled={pending} onClick={() => { setText(r.reply ?? ''); setReply(true); }}>{r.reply ? 'Edit reply' : 'Reply'}</button>}
      <button className="btn sm" type="button" disabled={pending} onClick={() => setDel(true)}>Delete</button>
    </div>
    <Dialog open={reply} onClose={() => !pending && setReply(false)} title={`Reply to ${r.authorName}`} description="Your reply shows under their review on your store."
      footer={<><button className="btn" type="button" onClick={() => setReply(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => replyToReviewAction(r.id, text), () => setReply(false))}>{pending ? 'Saving…' : text.trim() ? 'Save reply' : 'Remove reply'}</button></>}>
      <div className="field"><label htmlFor={`rr-${r.id}`}>Your reply</label><textarea id={`rr-${r.id}`} rows={4} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Thank you for the feedback…" /><small className="muted">{text.length}/1000</small></div>
    </Dialog>
    <Dialog open={del} onClose={() => !pending && setDel(false)} title="Delete this review?" description="It is removed for good. If you only want to hide it from your store, reject it instead."
      footer={<><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep</button><button className="btn danger" type="button" disabled={pending} onClick={() => run(() => deleteReviewAction(r.id), () => setDel(false))}>{pending ? 'Deleting…' : 'Delete'}</button></>}><span /></Dialog>
  </>);
}
