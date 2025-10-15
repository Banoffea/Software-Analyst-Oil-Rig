import { NavLink } from 'react-router-dom';
import { useAuth } from '../utils/auth.jsx';
import logo from '../assets/company_logo.png';

export default function Header({ onLogout }) {
  const { me, loading } = useAuth();
  const role = me?.role;

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  // สิทธิ์ของแต่ละหน้า
  const allow = {
    product: ['admin', 'manager', 'production'],
    vessels: ['admin', 'manager', 'captain', 'fleet'],
    reports: ['admin', 'manager', 'production', 'captain', 'fleet'],
    rigs:    ['admin', 'manager', 'production'],
    users:   ['admin'],
  };
  const can = (page) => !!role && allow[page]?.includes(role);

  return (
    <header className="site-header">
      <div className="container">
        <img src={logo} alt="Logo" width="auto" height="43" />
        <div className="brand">OffshoreManagingDashboards</div>

        <nav className="nav">
          {/* Product -> ใช้เส้นทาง /product */}
          {!loading && can('product') && (
            <NavLink to="/product" className={linkClass}>Product</NavLink>
          )}

          {/* Vessels */}
          {!loading && can('vessels') && (
            <NavLink to="/vessels" className={linkClass}>Vessels</NavLink>
          )}

          {/* Reports */}
          {!loading && can('reports') && (
            <NavLink to="/issues" className={linkClass}>Reports</NavLink>
          )}

          {/* Rigs */}
          {!loading && can('rigs') && (
            <NavLink to="/admin/rigs" className={linkClass}>Rigs</NavLink>
          )}

          {/* User Management (admin only) */}
          {!loading && can('users') && (
            <NavLink to="/admin/users" className={linkClass}>User Management</NavLink>
          )}
        </nav>

        <button className="btn btn-outline ml-auto btn-logout" onClick={onLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
