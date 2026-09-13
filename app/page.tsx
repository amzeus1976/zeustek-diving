import DiveApp from './dashboard-client';
import { requireChatGPTUser } from './chatgpt-auth';
import { allowedHouseholdUser } from '@/lib/server/household';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireChatGPTUser('/');
  if (!allowedHouseholdUser(user)) {
    return (
      <main className="household-access-denied">
        <h1>Private household dashboard</h1>
        <p>This account has not been invited to ZeusTek Diving.</p>
        <a href="/signout-with-chatgpt?return_to=/">Use a different account</a>
      </main>
    );
  }
  return <DiveApp userId={user.userId} />;
}
