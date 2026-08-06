export function buildSynologyLoginParams(
  account: string,
  password: string,
  authVersion: number,
): Record<string, string> {
  const params: Record<string, string> = {
    account,
    passwd: password,
    format: "sid",
  };

  if (authVersion >= 6) {
    params.enable_syno_token = "yes";
  }

  return params;
}

export function buildSynologySessionHeaders(synoToken?: string): Record<string, string> {
  return synoToken ? { "X-SYNO-TOKEN": synoToken } : {};
}

export function buildSynologyLogoutParams(): Record<string, string> {
  return {};
}
