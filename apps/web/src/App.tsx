import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken, getUser, homeFor } from './api';
import Shell from './Shell';
import Approvals from './pages/Approvals';
import Ask from './pages/Ask';
import Dept from './pages/Dept';
import Docs from './pages/Docs';
import Engineering from './pages/Engineering';
import Helpdesk from './pages/Helpdesk';
import Insights from './pages/Insights';
import Login from './pages/Login';
import ManCom from './pages/ManCom';

function RequireAuth({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const home = homeFor(getUser()?.claims ?? []);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/helpdesk" element={<Helpdesk />} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/mancom" element={<ManCom />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/engineering" element={<Engineering />} />
        <Route path="/dept/:slug" element={<Dept />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
