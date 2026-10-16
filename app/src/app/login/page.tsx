export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="shell">
      <h1>Parent sign-in</h1>
      {error === 'invalid' && <p role="alert">Email or password is incorrect.</p>}
      {error === 'unavailable' && <p role="alert">Sign-in is not available right now.</p>}
      <form method="post" action="/auth/sign-in">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
