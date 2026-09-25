import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function EditTenant() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="রেন্টি এডিট" onBack={() => navigate(-1)} />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
