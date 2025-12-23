import fs from "fs";
import common from "oci-common";
import identity from "oci-identity";

export default async function ociUsers({ groups }, debug = false) {
    if (!groups || !groups.length) {
        console.log("[OCI] No groups provided, skipping.");
        return new Set();
    }

    const privateKey = fs.readFileSync(
        process.env.OCI_PRIVATE_KEY_PATH,
        "utf8"
    );

    const provider = new common.SimpleAuthenticationDetailsProvider(
        process.env.OCI_TENANCY_OCID,
        process.env.OCI_USER_OCID,
        process.env.OCI_FINGERPRINT,
        privateKey,
        null,
        null 
    );

    const client = new identity.IdentityClient({
        authenticationDetailsProvider: provider
    });

    client.endpoint = "https://identity.us-chicago-1.oraclecloud.com";

    // Cache groups once
    const allGroups = await client.listGroups({
        compartmentId: process.env.OCI_TENANCY_OCID
    });

    const actual = new Set();

    for (const g of groups) {
        const groupName = g.name;

        const ociGroup = allGroups.items.find(
            og => og.name === groupName
        );

        if (!ociGroup) {
            console.warn(`[OCI] Group not found in OCI: ${groupName}`);
            continue;
        }

        let page;
        do {
            const r = await client.listUserGroupMemberships({
                compartmentId: process.env.OCI_TENANCY_OCID,
                groupId: ociGroup.id,
                limit: 1000,
                page
            });

            for (const m of r.items || []) {
                const u = await client.getUser({ userId: m.userId });
                if (u.user.lifecycleState !== "ACTIVE") continue;

                const email =
                    u.user.email?.toLowerCase() ||
                    (u.user.name?.includes("@") ? u.user.name.toLowerCase() : null);

                if (email) actual.add(email);
            }

            page = r.opcNextPage;
        } while (page);
    }

    return actual;
}
