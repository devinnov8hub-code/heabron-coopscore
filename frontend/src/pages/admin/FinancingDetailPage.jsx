import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, Send, Banknote } from 'lucide-react';
import api from '@/lib/api';
import { Card, Skeleton, StatusPill, TierPill } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { formatNaira, formatDate, relativeTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function FinancingDetailPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // 'approve' | 'reject' | 'disburse' | 'forward'
  const [voidTarget, setVoidTarget] = useState(null);
  const qc = useQueryClient();

  const { data: req, isLoading } = useQuery({
    queryKey: ['admin-financing', requestId],
    queryFn: () => api.get(`/admin/financing-requests/${requestId}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!req) return <Card><p className="py-12 text-center">Request not found</p></Card>;

  const coop = req.cooperatives;

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-smoke hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>

      <PageHeader
        eyebrow="Financing request"
        title={coop?.name || 'Cooperative request'}
        description={`Submitted ${relativeTime(req.created_at)}`}
        actions={<StatusPill status={req.status} />}
      />

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-1">Amount</p>
          <p className="font-display text-3xl font-semibold">{formatNaira(req.loan_amount)}</p>
          {req.approved_amount && <p className="text-xs text-smoke mt-1">Approved: {formatNaira(req.approved_amount)}</p>}
        </Card>
        <Card>
          <p className="eyebrow mb-1">Purpose</p>
          <p className="font-medium">{req.purpose}</p>
          <p className="text-xs text-smoke mt-1 capitalize">{req.season} season · {req.repayment_window_days} day window</p>
        </Card>
        <Card>
          <p className="eyebrow mb-1">Borrower tier</p>
          <TierPill tier={coop?.cooperative_tier} />
          {coop?.average_credit_score != null && <p className="text-xs text-smoke mt-1">Avg score {coop.average_credit_score}</p>}
        </Card>
      </div>

      {/* Decision panel */}
      {req.status === 'pending' && (
        <Card padded className="mb-6 bg-harvest-50 border-harvest-200">
          <p className="font-semibold mb-2">Awaiting your decision</p>
          <p className="text-sm text-smoke mb-4">Approve the loan in-house, forward it to a partner, or reject it.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModal('approve')}><Check className="size-4" /> Approve</Button>
            <Button variant="secondary" onClick={() => setModal('forward')}><Send className="size-4" /> Forward to partner</Button>
            <Button variant="danger" onClick={() => setModal('reject')}><X className="size-4" /> Reject</Button>
          </div>
        </Card>
      )}
      {req.status === 'approved' && !req.disbursed_at && (
        <Card padded className="mb-6 bg-forest-50 border-forest-200">
          <p className="font-semibold mb-2">Ready to disburse</p>
          <Button onClick={() => setModal('disburse')}><Banknote className="size-4" /> Mark as disbursed</Button>
        </Card>
      )}

      {/* Details */}
      <Card padded className="mb-6">
        <p className="eyebrow mb-1">Request</p>
        <h3 className="font-display text-xl font-semibold mb-4">Details</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <KV label="Cooperative" value={coop?.name} />
          <KV label="Cooperative state" value={coop?.state} />
          <KV label="Due date" value={formatDate(req.due_date)} />
          <KV label="Forwarded to" value={req.forwarded_to_partner_id ? 'Partner' : '—'} />
          <KV label="Partner decision" value={req.partner_decision || '—'} />
          <KV label="Disbursed" value={req.disbursed_at ? formatDate(req.disbursed_at) : '—'} />
          {req.rejection_reason && <KV label="Rejection reason" value={req.rejection_reason} />}
          {req.admin_comments && <KV label="Admin notes" value={req.admin_comments} />}
          {req.partner_comments && <KV label="Partner notes" value={req.partner_comments} />}
          {req.disbursement_reference && <KV label="Transfer reference" value={req.disbursement_reference} />}
        </dl>

        {(req.disbursement_account_details || (req.disbursement_proof_urls || []).length > 0) && (
          <div className="mt-5 pt-5 border-t border-whisper/60">
            <p className="text-xs uppercase tracking-wide text-smoke mb-2">Disbursement sent to agent</p>
            {req.disbursement_account_details && (
              <pre className="text-sm bg-bone rounded-xl p-3 whitespace-pre-wrap font-sans">{req.disbursement_account_details}</pre>
            )}
            {(req.disbursement_proof_urls || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {req.disbursement_proof_urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="size-24 rounded-lg overflow-hidden border border-whisper">
                    <img src={u} alt={`proof ${i + 1}`} className="size-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Repayments */}
      <Card padded>
        <p className="eyebrow mb-1">Repayments</p>
        <h3 className="font-display text-xl font-semibold mb-4">Repayment history</h3>
        {(req.repayment_records || []).length === 0 ? (
          <p className="text-sm text-smoke py-6 text-center">No repayments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-smoke border-b border-whisper/60">
                <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Method</th><th className="py-2 pr-4">Context</th><th className="py-2 pr-4">Proof</th><th className="py-2 pr-4">Reference</th><th className="py-2 pr-4 text-right">Action</th>
              </tr></thead>
              <tbody>
                {req.repayment_records.map((r) => (
                  <tr key={r.id} className={`border-b border-whisper/40 last:border-0 ${r.voided ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-4">{formatDate(r.payment_date)}</td>
                    <td className="py-2 pr-4 font-semibold">
                      <span className={r.voided ? 'line-through' : ''}>{formatNaira(r.amount_paid)}</span>
                      {r.voided && <span className="ml-2 text-[10px] uppercase text-red-600 font-medium">voided</span>}
                    </td>
                    <td className="py-2 pr-4 capitalize">{r.payment_method?.replace('_', ' ')}</td>
                    <td className="py-2 pr-4">{r.context_flag === 'none' || !r.context_flag ? '—' : <span className="text-xs px-2 py-0.5 rounded bg-harvest-50 text-harvest-700">{r.context_flag}</span>}</td>
                    <td className="py-2 pr-4">
                      {r.proof_photo_url ? (
                        <a href={r.proof_photo_url} target="_blank" rel="noreferrer" className="inline-block size-9 rounded-md overflow-hidden border border-whisper">
                          <img src={r.proof_photo_url} alt="proof" className="size-full object-cover" />
                        </a>
                      ) : <span className="text-xs text-smoke">—</span>}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.reference_number || '—'}</td>
                    <td className="py-2 pr-4 text-right">
                      {r.voided ? (
                        <span className="text-xs text-smoke">—</span>
                      ) : (
                        <button onClick={() => setVoidTarget(r)} className="text-xs text-red-600 hover:text-red-700 font-medium">Void</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {voidTarget && (
        <VoidRepaymentModal
          repayment={voidTarget}
          onClose={() => setVoidTarget(null)}
          onDone={() => { setVoidTarget(null); qc.invalidateQueries({ queryKey: ['admin-financing', requestId] }); }}
        />
      )}

      <DecisionModal
        open={!!modal}
        kind={modal}
        request={req}
        onClose={() => setModal(null)}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['admin-financing'] });
          setModal(null);
        }}
      />
    </>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <p className="text-xs text-smoke uppercase tracking-wider mb-0.5">{label}</p>
      <p className="font-medium text-ink">{value || '—'}</p>
    </div>
  );
}

function DecisionModal({ open, kind, request, onClose, onDone }) {
  const [approvedAmount, setApprovedAmount] = useState(request?.loan_amount || '');
  const [dueDate, setDueDate] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminComments, setAdminComments] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [disbReference, setDisbReference] = useState('');
  const [disbProof, setDisbProof] = useState([]);

  const { data: partners } = useQuery({
    queryKey: ['admin-partners-active'],
    queryFn: () => api.raw.get('/admin/partners', { params: { status: 'active', pageSize: 100 } }).then((r) => r.data?.data || []),
    enabled: kind === 'forward',
  });

  const mutate = useMutation({
    mutationFn: (body) => api.post(`/admin/financing-requests/${request.id}/decision`, body),
    onSuccess: () => { toast.success('Decision recorded'); onDone(); },
  });

  function submit() {
    const body = { decision: kind === 'forward' ? 'approved' : kind === 'disburse' ? 'disbursed' : kind, adminComments };
    if (kind === 'approve' || kind === 'forward' || kind === 'disburse') {
      if (approvedAmount) body.approvedAmount = Number(approvedAmount);
      if (dueDate) body.dueDate = dueDate;
    }
    if (kind === 'forward') body.forwardToPartnerId = partnerId;
    if (kind === 'reject') body.rejectionReason = rejectionReason;
    if (kind === 'disburse') {
      if (accountDetails) body.disbursementAccountDetails = accountDetails;
      if (disbReference) body.disbursementReference = disbReference;
      if (disbProof.length) body.disbursementProofUrls = disbProof;
    }
    mutate.mutate(body);
  }

  if (!open) return null;
  const titles = { approve: 'Approve in-house', forward: 'Forward to partner', disburse: 'Mark as disbursed', reject: 'Reject request' };

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[kind]}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutate.isPending}>Cancel</Button>
          <Button variant={kind === 'reject' ? 'danger' : 'primary'} loading={mutate.isPending} onClick={submit}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kind === 'forward' && (
          <Field label="Partner" required>
            <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
              <option value="">Select a partner organization…</option>
              {(partners || []).map((p) => <option key={p.id} value={p.id}>{p.organization_name}</option>)}
            </Select>
          </Field>
        )}
        {(kind === 'approve' || kind === 'forward' || kind === 'disburse') && (
          <>
            <Field label="Approved amount (NGN)">
              <Input type="number" min="0" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
            </Field>
            <Field label="Repayment due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </>
        )}
        {kind === 'reject' && (
          <Field label="Reason" required>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required placeholder="Why is this request being rejected?" />
          </Field>
        )}
        {kind === 'disburse' && (
          <>
            <Field label="Account details sent to" hint="Bank, account number & name the funds were sent to — the agent will see this">
              <Textarea value={accountDetails} onChange={(e) => setAccountDetails(e.target.value)}
                placeholder={'e.g.\nBank: GTBank\nAccount: 0123456789\nName: Hansel Cooperative'} />
            </Field>
            <Field label="Transfer reference" hint="Optional">
              <Input value={disbReference} onChange={(e) => setDisbReference(e.target.value)} placeholder="TXN93838383" />
            </Field>
            <Field label="Proof of payment" hint="Receipt/screenshot or PDF — visible to the field agent">
              <ImageUpload value={disbProof} onChange={setDisbProof} endpoint="/admin/uploads/transaction_receipt" />
            </Field>
          </>
        )}
        <Field label="Admin notes" hint="Optional internal note">
          <Textarea value={adminComments} onChange={(e) => setAdminComments(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function VoidRepaymentModal({ repayment, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const mutate = useMutation({
    mutationFn: () => api.post(`/admin/repayments/${repayment.id}/void`, { reason: reason || undefined }),
    onSuccess: () => { toast.success('Repayment voided — balance & score updated'); onDone(); },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to void'),
  });
  return (
    <Modal
      open onClose={onClose}
      title="Void this repayment?"
      description={`This reverses ${formatNaira(repayment.amount_paid)} from ${formatDate(repayment.payment_date)}. The outstanding balance and credit score recalculate immediately. The record is kept (struck through) for audit — not deleted.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutate.isPending}>Cancel</Button>
          <Button variant="danger" loading={mutate.isPending} onClick={() => mutate.mutate()}><X className="size-4" /> Void repayment</Button>
        </>
      }
    >
      <Field label="Reason" hint="Optional — why is this being reversed?">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate entry, wrong amount, proof rejected…" />
      </Field>
    </Modal>
  );
}
