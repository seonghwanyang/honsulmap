import { redirect } from 'next/navigation';

// Portal entry → straight to the dashboard, which gates on login itself
// (AuthGate shows the sign-in screen when logged out).
export default function PartnerHome() {
  redirect('/partner/dashboard');
}
