import { NavLink } from 'react-router-dom';
import { useAuth } from '../utils/auth.jsx';
import logo from '../assets/company_logo.png';

export default function Header({ onLogout }) {
  const { me, loading } = useAuth();

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  // admin/manager เท่านั้น
  const canManage = !!me && (me.role === 'admin' || me.role === 'manager');

  return (
    <header className="site-header">
      <div className="container">
        <img
          src={logo}
          alt="Logo"
          width='auto'
          height="43"
        />
        <div className="brand">OffshoreManagingDashboards</div>

        <nav className="nav">
          <NavLink to="/" end className={linkClass}>Product</NavLink>
          <NavLink to="/vessels" className={linkClass}>Vessels</NavLink>
          <NavLink to="/issues" className={linkClass}>Reports</NavLink>

          {/* admin เท่านั้น */}
          {!loading && canManage && (
            <>
              <NavLink to="/admin/rigs" className={linkClass}>Rigs</NavLink>
              <NavLink to="/admin/users" className={linkClass}>User Management</NavLink>
            </>
          )}
        </nav>

        <button className="btn btn-outline ml-auto btn-logout" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}
