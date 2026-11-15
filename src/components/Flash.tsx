export function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  const o = Array.isArray(ok) ? ok[0] : ok;
  const e = Array.isArray(error) ? error[0] : error;
  return (
    <>
      {o && <p className="notice-ok mb-4">{o}</p>}
      {e && <p className="notice-error mb-4">{e}</p>}
    </>
  );
}
