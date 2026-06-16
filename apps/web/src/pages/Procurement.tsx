import { useEffect, useState } from 'react';
import { api } from '../api';
import { Loader, SheetBar } from '../ui';

interface Intake { id: string; projectCode: string; weekOf: string; lines: number; approval: string; status: string }
interface Supplier { supplier: string; deliveries: number; avgLateDays: number }

const tone = (s: string) => (s === 'ready-to-buy' ? 'st-ok' : s === 'returned' ? 'st-bad' : 'st-warn');

/** Procurement inbox — approved materials schedules arriving from Engineering. */
export default function Procurement() {
  const [intake, setIntake] = useState<Intake[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Intake[]>('/procurement/materials-intake').then(setIntake),
      api<Supplier[]>('/procurement/supplier-performance').then(setSuppliers),
    ]).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <><SheetBar sheet="PRC-T" title="Procurement" /><div className="err">{error}</div></>;
  if (!intake) return <><SheetBar sheet="PRC-T" title="Procurement" /><Loader label="Loading procurement inbox" /></>;

  return (
    <>
      <SheetBar sheet="PRC-T" title="Procurement — materials intake & suppliers" note="Approved (PE→PM→VPO) materials schedules land here, ready to buy" />
      <div className="grid2">
        <div className="card">
          <div className="ph"><b>Incoming materials schedules</b><span className="src">SRC · procurement.materials-intake</span></div>
          {intake.length === 0 ? <div className="muted">No schedules yet — Engineering submits them via the materials schedule.</div> : (
            <table className="tbl">
              <thead><tr><th>Project</th><th>Week</th><th>Lines</th><th>Approval</th><th>Status</th></tr></thead>
              <tbody>
                {intake.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.projectCode}</b></td><td>{r.weekOf}</td><td>{r.lines}</td>
                    <td>{r.approval}</td>
                    <td><span className={`st ${tone(r.status)}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="ph"><b>Supplier delivery performance</b><span className="src">SRC · procurement.supplier-performance</span></div>
          <table className="tbl">
            <thead><tr><th>Supplier</th><th>Deliveries</th><th>Avg late</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.supplier}>
                  <td>{s.supplier}</td><td>{s.deliveries}</td>
                  <td><span className={`st ${s.avgLateDays > 1 ? 'st-bad' : 'st-ok'}`}>{s.avgLateDays}d</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
