import { useQuery } from '@tanstack/react-query';
import API from '../../api/axios';
import MoneyAmount from '../../components/MoneyAmount';

const STATUS_COLOR = {
  paid:      '#10b981',
  processed: '#6366f1',
  pending:   '#f59e0b',
  'on-hold': '#ef4444',
};

export default function Payroll() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: () => API.get('/payroll/my').then(r => r.data),
  });

  const payslips = data?.data || [];

  if (isLoading) return (
    <div style={{ padding: 40, color: '#44445a', textAlign: 'center' }}>Loading payslips…</div>
  );

  return (
    <div className="page-fade-in">
      <h1 className="page-title">My Payslips</h1>
      <p className="page-subtitle">Monthly salary breakdown · Contact HR for corrections</p>

      {payslips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#44445a' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
          <p>No payslips yet. Contact HR if you expect one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {payslips.map(p => {
            const sc = STATUS_COLOR[p.status] || '#7070a0';
            const totalAllowances =
              (p.allowances?.hra || 0) + (p.allowances?.transport || 0) +
              (p.allowances?.internet || 0) + (p.allowances?.medical || 0) +
              (p.allowances?.other || 0);

            return (
              <div key={p._id} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 20,
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                      {p.month}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: sc,
                      padding: '2px 8px', background: `${sc}18`,
                      borderRadius: 99, textTransform: 'capitalize',
                      marginTop: 4, display: 'inline-block',
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: 'Syne, sans-serif' }}>
                    <MoneyAmount value={p.netPay} scope="global" key="my-payroll" />
                  </div>
                </div>

                {/* Earnings / deductions grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {[
                    ['Basic Salary',       p.basicSalary,            '#e0e0f0'],
                    ['Total Allowances',   totalAllowances,           '#a5b4fc'],
                    ['PF Deduction',       p.deductions?.pf || 0,     '#f87171'],
                    ['Tax (TDS)',          p.deductions?.tax || 0,    '#f87171'],
                  ].filter(([, v]) => v > 0).map(([label, val, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#7070a0' }}>{label}</span>
                      <span style={{ color, fontWeight: 600 }}>
                        <MoneyAmount value={val} scope="global" key="my-payroll" />
                      </span>
                    </div>
                  ))}
                </div>

                {/* Allowances breakdown */}
                {totalAllowances > 0 && (
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 16, flexWrap: 'wrap',
                  }}>
                    {[
                      ['HRA',       p.allowances?.hra],
                      ['Transport', p.allowances?.transport],
                      ['Internet',  p.allowances?.internet],
                      ['Medical',   p.allowances?.medical],
                    ].filter(([, v]) => v > 0).map(([label, val]) => (
                      <div key={label} style={{ fontSize: 11.5 }}>
                        <span style={{ color: '#44445a' }}>{label}: </span>
                        <span style={{ color: '#7070a0' }}>
                          <MoneyAmount value={val} scope="global" key="my-payroll" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
