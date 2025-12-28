// frontend/src/components/Header.jsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../utils/auth.jsx';
import logo from '../assets/company_logo.png';

export default function Header({ onLogout }) {
  const { me, loading } = useAuth();
  const role = me?.role;
  const name = me?.display_name || me?.username || '-';

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  const allow = {
    product: ['admin', 'manager', 'production'],
    vessels: ['admin', 'manager', 'captain', 'fleet'],
    reports: ['admin', 'manager', 'production', 'captain', 'fleet'],
    rigs:    ['admin', 'manager', 'production'],
    users:   ['admin'],
  };
  const can = (page) => !!role && allow[page]?.includes(role);

  const roleLabel = (role || '').replaceAll('_', ' ') || '-';
  const roleClass =
    role === 'admin'      ? 'badge role-admin'      :
    role === 'manager'    ? 'badge role-manager'    :
    role === 'production' ? 'badge role-production' :
    role === 'captain'    ? 'badge role-captain'    :
    role === 'fleet'      ? 'badge role-fleet'      :
                            'badge role-default';

  return (
    <header className="site-header">
      <div className="container">
        <img src={logo} alt="Logo" width="auto" height="43" />
        <div className="brand">OffshoreManagingDashboards</div>

        <nav className="nav">
          {!loading && can('product') && (
            <NavLink to="/product" className={linkClass}>Product</NavLink>
          )}
          {!loading && can('rigs') && (
            <NavLink to="/admin/rigs" className={linkClass}>Rigs</NavLink>
          )}
          {!loading && can('vessels') && (
            <NavLink to="/vessels" className={linkClass}>Vessels</NavLink>
          )}
          {!loading && can('reports') && (
            <NavLink to="/issues" className={linkClass}>Reports</NavLink>
          )}
          {!loading && can('users') && (
            <NavLink to="/admin/users" className={linkClass}>User Management</NavLink>
          )}
        </nav>

        <div className="userbox ml-auto">
          {loading ? (
            <div className="skeleton" />
          ) : (
            <>
              <div className="userinfo">
                <div className="username" title={name}>{name}</div>
                <span className={roleClass} aria-label="role">{roleLabel}</span>
              </div>
            </>
          )}
          <button className="btn btn-outline btn-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      {/* --- NEW: role badge styles --- */}
      <style>{`
        .userbox{display:flex;align-items:center;gap:10px}
        .userinfo{display:flex;align-items:center;gap:10px;max-width:300px}
        .username{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e5e7eb}

        .badge{
          display:inline-flex; align-items:center; gap:6px;
          height:26px; padding:0 10px;
          font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.14);
          background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08));
          color:#f8fafc;
          box-shadow:0 2px 10px rgba(0,0,0,.18) inset, 0 1px 0 rgba(255,255,255,.05);
          backdrop-filter: blur(2px);
        }
        .badge::before{
          content:''; display:inline-block; width:7px; height:7px; border-radius:999px;
          box-shadow:0 0 0 2px rgba(0,0,0,.3) inset;
        }

        /* Role palettes (อ่านง่ายบนพื้นหลังเข้ม) */
        .role-admin{
          background:linear-gradient(180deg, rgba(239,68,68,.2), rgba(127,29,29,.25));
          border-color:rgba(239,68,68,.35);
        }
        .role-admin::before{ background:#ef4444; }

        .role-manager{
          background:linear-gradient(180deg, rgba(37,99,235,.22), rgba(23,37,84,.28));
          border-color:rgba(37,99,235,.35);
        }
        .role-manager::before{ background:#2563eb; }

        .role-production{
          background:linear-gradient(180deg, rgba(79,70,229,.22), rgba(39,39,109,.28));
          border-color:rgba(79,70,229,.35);
        }
        .role-production::before{ background:#4f46e5; }

        .role-captain{
          background:linear-gradient(180deg, rgba(13,148,136,.22), rgba(6,78,59,.28));
          border-color:rgba(13,148,136,.35);
        }
        .role-captain::before{ background:#0d9488; }

        .role-fleet{
          background:linear-gradient(180deg, rgba(5,150,105,.22), rgba(2,44,34,.28));
          border-color:rgba(5,150,105,.35);
        }
        .role-fleet::before{ background:#059669; }

        .role-default{
          background:linear-gradient(180deg, rgba(107,114,128,.22), rgba(31,41,55,.28));
          border-color:rgba(107,114,128,.35);
        }
        .role-default::before{ background:#9ca3af; }

        .skeleton{
          width:160px; height:20px; border-radius:8px;
          background:linear-gradient(90deg,#1f2937,#111827,#1f2937);
          background-size:200% 100%; animation:sk 1.2s infinite linear;
        }
        @keyframes sk{0%{background-position:0% 0}100%{background-position:200% 0}}
      `}</style>
    </header>
  );
}
