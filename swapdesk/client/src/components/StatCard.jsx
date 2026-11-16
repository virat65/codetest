export default function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {Icon && <div className="stat-icon"><Icon size={19} /></div>}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
