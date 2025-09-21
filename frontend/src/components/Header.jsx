import { NavLink } from 'react-router-dom';
import { useAuth } from '../utils/auth.jsx';

export default function Header({ onLogout }) {
  const { me, loading } = useAuth();

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  // admin / manager เท่านั้น
  const canManage = !!me && (me.role === 'admin' || me.role === 'manager');

  return (
    <header className="site-header">
      <div className="container">
        <div className="brand">Oil Ops</div>

        <nav className="nav">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/vessels" className={linkClass}>Vessels</NavLink>
          <NavLink to="/issues" className={linkClass}>Issues</NavLink>

          {/* ลิงก์สำหรับงานแอดมิน/เมเนเจอร์ */}
          {!loading && canManage && (
            <>
              <NavLink to="/admin/rigs" className={linkClass}>Rigs</NavLink>
              <NavLink to="/admin/users" className={linkClass}>User Admin</NavLink>
            </>
          )}
        </nav>

        <button className="btn btn-outline" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
