import { describe, expect, it } from "vitest";
import {
  collectOidcGroupIds,
  mapDirectoryGroupsToRoleKeys,
  parseGroupRoleMap,
  rowsToGroupRoleMap,
} from "@/server/auth/oidc-groups";
import {
  assertIdTokenClaims,
  decodeJwtPayload,
  profileFromIdToken,
} from "@/server/auth/oidc-client";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("parseGroupRoleMap", () => {
  it("parses comma pairs using the last colon", () => {
    const map = parseGroupRoleMap(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:ADMIN,HR Managers:BRANCH_MANAGER",
    );
    expect(map["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"]).toBe("ADMIN");
    expect(map["HR Managers"]).toBe("BRANCH_MANAGER");
  });

  it("parses JSON objects", () => {
    expect(parseGroupRoleMap('{"g1":"EMPLOYEE","g2":"ADMIN"}')).toEqual({
      g1: "EMPLOYEE",
      g2: "ADMIN",
    });
  });

  it("returns empty for blank or invalid JSON", () => {
    expect(parseGroupRoleMap("")).toEqual({});
    expect(parseGroupRoleMap("{nope")).toEqual({});
  });
});

describe("mapDirectoryGroupsToRoleKeys", () => {
  const mapping = {
    "11111111-1111-1111-1111-111111111111": "ADMIN",
    "HR Managers": "BRANCH_MANAGER",
    MehrsaOps: "MEETING_OPERATOR",
  };

  it("maps Azure group object ids to role keys (case-insensitive)", () => {
    expect(
      mapDirectoryGroupsToRoleKeys({
        groups: ["11111111-1111-1111-1111-111111111111"],
        mapping,
        fallback: null,
      }),
    ).toEqual(["ADMIN"]);
  });

  it("maps display names and collects unique roles", () => {
    const keys = mapDirectoryGroupsToRoleKeys({
      groups: ["hr managers", "MehrsaOps", "unknown-group"],
      mapping,
      fallback: null,
    }).sort();
    expect(keys).toEqual(["BRANCH_MANAGER", "MEETING_OPERATOR"]);
  });

  it("falls back to EMPLOYEE when nothing matches", () => {
    expect(
      mapDirectoryGroupsToRoleKeys({
        groups: ["nope"],
        mapping,
      }),
    ).toEqual(["EMPLOYEE"]);
  });

  it("returns empty when fallback is null and nothing matches", () => {
    expect(
      mapDirectoryGroupsToRoleKeys({
        groups: ["nope"],
        mapping,
        fallback: null,
      }),
    ).toEqual([]);
  });
});

describe("collectOidcGroupIds", () => {
  it("reads Azure groups and app roles", () => {
    expect(
      collectOidcGroupIds({
        groups: ["g-1", "g-2"],
        roles: ["App.Admin"],
      }),
    ).toEqual(["g-1", "g-2", "App.Admin"]);
  });

  it("reads Graph memberOf value objects", () => {
    expect(
      collectOidcGroupIds({
        value: [
          { id: "gid", displayName: "Finance" },
          { id: "gid" },
        ],
      }),
    ).toEqual(["gid", "Finance"]);
  });
});

describe("id token claims", () => {
  it("decodes payload and builds a profile from preferred_username", () => {
    const jwt = fakeJwt({
      aud: "client-1",
      iss: "https://login.microsoftonline.com/tid/v2.0",
      nonce: "n1",
      exp: Math.floor(Date.now() / 1000) + 300,
      preferred_username: "sara@corp.com",
      name: "سارا نجفی",
      groups: ["HR Managers"],
    });
    const claims = decodeJwtPayload(jwt);
    assertIdTokenClaims(claims, { clientId: "client-1", nonce: "n1" });
    const profile = profileFromIdToken(claims);
    expect(profile.email).toBe("sara@corp.com");
    expect(profile.fullName).toBe("سارا نجفی");
  });

  it("rejects audience mismatch", () => {
    const claims = decodeJwtPayload(
      fakeJwt({
        aud: "other",
        iss: "https://login.microsoftonline.com/tid/v2.0",
        nonce: "n1",
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    );
    expect(() => assertIdTokenClaims(claims, { clientId: "client-1", nonce: "n1" })).toThrow(
      /audience/,
    );
  });
});

describe("rowsToGroupRoleMap", () => {
  it("drops blank rows", () => {
    expect(
      rowsToGroupRoleMap([
        { group: " g1 ", roleKey: " ADMIN " },
        { group: "", roleKey: "EMPLOYEE" },
      ]),
    ).toEqual({ g1: "ADMIN" });
  });
});
