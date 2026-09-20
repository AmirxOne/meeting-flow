# identity-dependent suites: create on behalf of the intended user (admin organizerId=X)
import io, re

p = "tests/integration/api.test.ts"
s = io.open(p, encoding="utf-8").read()

# ── participant rsvp: meeting belongs to ali (notifications go to him) ──
s = s.replace('''    const created = await api("/api/meetings", {
      method: "POST",
      cookie: operatorCookie,
      json: {
        title: "تست RSVP — دعوت با PENDING",''',
'''    const created = await api("/api/meetings", {
      method: "POST",
      cookie: adminCookie, // employees file requests now — create ON BEHALF of ali
      json: {
        organizerId: (await api("/api/users?q=ali", { cookie: adminCookie })).body.data.users.find((u: { email: string }) => u.email === "ali@example.com")?.id,
        title: "تست RSVP — دعوت با PENDING",''', 1)
io.open(p, "w", encoding="utf-8").write(s)
print("rsvp on-behalf")
