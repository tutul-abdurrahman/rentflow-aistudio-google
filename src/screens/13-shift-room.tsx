import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function ShiftRoom() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="রুম শিফট" onBack={() => navigate(-1)} />
      <p className="mt-6 text-sm text-ink-muted">— নির্মাধীন —</p>
    </>
  );
}
