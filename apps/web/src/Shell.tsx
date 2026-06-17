import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getUser, hasClaim } from './api';
import AssistantFab from './AssistantFab';

const departments = [
  ['engineering', 'Engineering'],
  ['procurement', 'Procurement'],
  ['operations', 'Operations'],
  ['survey', 'Survey'],
  ['mqc', 'MQC'],
  ['audit', 'Audit'],
  ['it', 'IT'],
  ['records', 'Records'],
  ['clinic', 'Clinic'],
  ['admin', 'Admin / OHS'],
  ['hr', 'HR'],
  ['property', 'Property'],
  ['finance', 'Finance'],
] as const;

export default function Shell() {
  const user = getUser();
  const navigate = useNavigate();
  const executive = hasClaim(user, 'role:ceo') || hasClaim(user, 'role:vpo');
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const item = (to: string, label: string, dim = false) => (
    <NavLink key={to} to={to} className={({ isActive }) => `sitem${isActive ? ' on' : ''}${dim ? ' dim' : ''}`}>
      {label}
    </NavLink>
  );

  return (
    <div className="shell">
      <nav className="side">
        <div className="sbrand">
          <div className="slogo">U</div>
          <div>
            <b>UBI Suite</b>
            <span>Construction</span>
          </div>
        </div>
        <div className="sentity">
          <span>Entity</span> <b>{user?.entity ?? 'UBI'}</b>
        </div>

        {executive && (
          <>
            <div className="sgrp">Office of the President</div>
            {item('/mancom', 'ManCom')}
            {item('/insights', 'AI Insights')}
          </>
        )}

        <div className="sgrp">Work</div>
        {item('/ask', 'Ask AI')}
        {item('/approvals', 'Approvals')}
        {item('/docs', 'Documents')}
        {item('/helpdesk', 'Helpdesk')}
        {item('/fleet', 'Omega / Fleet')}

        <div className="sgrp">Tools</div>
        {item('/survey', 'Survey tools')}
        {item('/mqc', 'MQC tools')}

        <div className="sgrp">Departments</div>
        {departments.map(([slug, label]) => item(`/dept/${slug}`, label, true))}

        <div className="suser">
          <div className="av">{initials}</div>
          <div>
            <b>{user?.name}</b>
            <span>{user?.claims.join(' · ')}</span>
          </div>
          <button
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            out
          </button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <AssistantFab />
    </div>
  );
}
