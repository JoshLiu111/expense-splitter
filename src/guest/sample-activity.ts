import type { ActivityEntry, CalendarDate, GroupSnapshot } from "@/domain";

/**
 * Activity for the sample Groups, newest first: changes their Members made
 * once Activity started, after recording the rest. Each edit's "after" is
 * the Expense or Group as `data/sample-groups.json` has it now, each deleted
 * Expense is one no longer there, each change to a Member leaves them as the
 * seed data has them, and the Custom Categories added, renamed and deleted
 * leave the ones it has; a test holds all of it to the seed data.
 */
export const SAMPLE_ACTIVITY: Record<string, { startedOn: CalendarDate; entries: ActivityEntry[] }> = {
  grp_japan_2024: {
    startedOn: "2024-03-23",
    entries: [
      {
        id: "act_japan_4",
        at: "2024-03-27T08:10:00.000Z",
        actorMemberId: "mem_taylor",
        change: {
          kind: "group-details-edited",
          before: { name: "Trip to Japan", description: "Two weeks in Tokyo, Kyoto, and Osaka." },
          after: {
            name: "Trip to Japan",
            description: "Two weeks in Tokyo, Kyoto, and Osaka. Cherry blossom season 2024.",
          },
        },
      },
      {
        id: "act_japan_3",
        at: "2024-03-26T19:02:00.000Z",
        actorMemberId: "mem_sam",
        change: {
          kind: "settlement-added",
          // ¥8,500 at a Locked Rate of 0.0067: $56.95 (ADR 0009).
          settlement: {
            id: "stl_002",
            fromId: "mem_sam",
            toId: "mem_taylor",
            amount: 8500,
            currency: "JPY",
            lockedRate: "0.0067",
            date: "2024-03-26",
            createdAt: "2024-03-26T19:00:00.000Z",
          },
        },
      },
      {
        id: "act_japan_2",
        at: "2024-03-26T09:15:00.000Z",
        actorMemberId: "mem_jordan",
        change: {
          kind: "expense-edited",
          before: {
            id: "exp_012",
            description: "Izakaya dinner in Dotonbori",
            amount: 42600,
            currency: "JPY",
            lockedRate: "0.0067",
            payerId: "mem_alex",
            splitType: "equal",
            shares: [
              { memberId: "mem_alex", amount: 10650 },
              { memberId: "mem_jordan", amount: 10650 },
              { memberId: "mem_sam", amount: 10650 },
              { memberId: "mem_taylor", amount: 10650 },
            ],
            date: "2024-03-25",
            createdAt: "2024-03-25T20:30:00.000Z",
            category: "Food & Drink",
          },
          after: {
            id: "exp_012",
            description: "Izakaya dinner in Dotonbori",
            amount: 42600,
            currency: "JPY",
            lockedRate: "0.0067",
            payerId: "mem_alex",
            splitType: "shares",
            shares: [
              { memberId: "mem_alex", amount: 14200, ratio: "2" },
              { memberId: "mem_jordan", amount: 14200, ratio: "2" },
              { memberId: "mem_sam", amount: 7100, ratio: "1" },
              { memberId: "mem_taylor", amount: 7100, ratio: "1" },
            ],
            date: "2024-03-25",
            createdAt: "2024-03-25T20:30:00.000Z",
            category: "Food & Drink",
            notes: "Alex and Jordan ordered premium sake",
          },
        },
      },
      {
        id: "act_japan_1",
        at: "2024-03-23T08:40:00.000Z",
        actorMemberId: "mem_sam",
        change: {
          kind: "expense-deleted",
          expense: {
            id: "exp_014",
            description: "Taxi to Gion",
            amount: 2200,
            currency: "JPY",
            lockedRate: "0.0067",
            payerId: "mem_sam",
            splitType: "equal",
            shares: [
              { memberId: "mem_alex", amount: 550 },
              { memberId: "mem_jordan", amount: 550 },
              { memberId: "mem_sam", amount: 550 },
              { memberId: "mem_taylor", amount: 550 },
            ],
            date: "2024-03-22",
            createdAt: "2024-03-22T22:00:00.000Z",
            category: "Transport",
          },
        },
      },
    ],
  },
  grp_apt_4b: {
    startedOn: "2024-01-13",
    entries: [
      {
        id: "act_apt_2",
        at: "2024-02-06T09:00:00.000Z",
        actorMemberId: "mem_casey",
        change: {
          kind: "expense-edited",
          before: {
            id: "exp_107",
            description: "February electricity",
            amount: 15892,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_casey",
            splitType: "equal",
            shares: [
              { memberId: "mem_riley", amount: 5298 },
              { memberId: "mem_casey", amount: 5297 },
              { memberId: "mem_drew", amount: 5297 },
            ],
            date: "2024-02-05",
            createdAt: "2024-02-05T10:00:00.000Z",
            category: "Utilities",
          },
          after: {
            id: "exp_107",
            description: "February electricity",
            amount: 16892,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_casey",
            splitType: "equal",
            shares: [
              { memberId: "mem_riley", amount: 5631 },
              { memberId: "mem_casey", amount: 5631 },
              { memberId: "mem_drew", amount: 5630 },
            ],
            date: "2024-02-05",
            createdAt: "2024-02-05T10:00:00.000Z",
            category: "Utilities",
          },
        },
      },
      {
        id: "act_apt_1",
        at: "2024-01-13T10:00:00.000Z",
        actorMemberId: "mem_casey",
        change: {
          kind: "expense-deleted",
          expense: {
            id: "exp_111",
            description: "Paper towels",
            amount: 899,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_drew",
            splitType: "equal",
            shares: [
              { memberId: "mem_riley", amount: 300 },
              { memberId: "mem_casey", amount: 300 },
              { memberId: "mem_drew", amount: 299 },
            ],
            date: "2024-01-12",
            createdAt: "2024-01-12T11:30:00.000Z",
            category: "Other",
          },
        },
      },
    ],
  },
  grp_office_lunch: {
    startedOn: "2024-02-21",
    entries: [
      {
        id: "act_office_3",
        at: "2024-03-05T09:00:00.000Z",
        actorMemberId: "mem_mia",
        change: {
          kind: "member-email-set",
          member: { id: "mem_ethan", name: "Ethan Nakamura" },
          email: "ethan@example.com",
        },
      },
      {
        id: "act_office_2",
        at: "2024-03-04T15:00:00.000Z",
        actorMemberId: "mem_priya",
        change: {
          kind: "expense-edited",
          before: {
            id: "exp_207",
            description: "Sushi lunch",
            amount: 8920,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_priya",
            splitType: "equal",
            shares: [
              { memberId: "mem_mia", amount: 2230 },
              { memberId: "mem_noah", amount: 2230 },
              { memberId: "mem_priya", amount: 2230 },
              { memberId: "mem_ethan", amount: 2230 },
            ],
            date: "2024-03-04",
            createdAt: "2024-03-04T12:30:00.000Z",
            category: "Food & Drink",
          },
          after: {
            id: "exp_207",
            description: "Sushi lunch",
            amount: 8920,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_priya",
            splitType: "percentage",
            shares: [
              { memberId: "mem_mia", amount: 2676, percentage: "30" },
              { memberId: "mem_noah", amount: 1784, percentage: "20" },
              { memberId: "mem_priya", amount: 2676, percentage: "30" },
              { memberId: "mem_ethan", amount: 1784, percentage: "20" },
            ],
            date: "2024-03-04",
            createdAt: "2024-03-04T12:30:00.000Z",
            category: "Food & Drink",
            notes: "Mia and Priya had the premium omakase",
          },
        },
      },
      {
        id: "act_office_1",
        at: "2024-02-21T11:00:00.000Z",
        actorMemberId: "mem_noah",
        change: {
          kind: "expense-deleted",
          expense: {
            id: "exp_209",
            description: "Bagels",
            amount: 1850,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_noah",
            splitType: "equal",
            shares: [
              { memberId: "mem_mia", amount: 463 },
              { memberId: "mem_noah", amount: 463 },
              { memberId: "mem_priya", amount: 462 },
              { memberId: "mem_ethan", amount: 462 },
            ],
            date: "2024-02-21",
            createdAt: "2024-02-21T09:00:00.000Z",
            category: "Food & Drink",
          },
        },
      },
    ],
  },
  grp_birthday: {
    startedOn: "2024-02-15",
    entries: [
      {
        id: "act_birthday_3",
        at: "2024-02-17T14:31:00.000Z",
        actorMemberId: "mem_chloe",
        change: {
          kind: "settlement-added",
          settlement: {
            id: "stl_302",
            fromId: "mem_chloe",
            toId: "mem_olivia",
            amount: 1875,
            currency: "USD",
            lockedRate: "1",
            date: "2024-02-17",
            createdAt: "2024-02-17T14:30:00.000Z",
          },
        },
      },
      {
        id: "act_birthday_2",
        at: "2024-02-16T12:00:00.000Z",
        actorMemberId: "mem_marcus",
        change: {
          kind: "expense-edited",
          before: {
            id: "exp_304",
            description: "Flowers",
            amount: 3500,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_marcus",
            splitType: "equal",
            shares: [
              { memberId: "mem_olivia", amount: 875 },
              { memberId: "mem_ben", amount: 875 },
              { memberId: "mem_chloe", amount: 875 },
              { memberId: "mem_marcus", amount: 875 },
            ],
            date: "2024-02-16",
            createdAt: "2024-02-16T09:00:00.000Z",
            category: "Shopping",
          },
          after: {
            id: "exp_304",
            description: "Flowers",
            amount: 3500,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_marcus",
            splitType: "exact",
            shares: [
              { memberId: "mem_olivia", amount: 1500 },
              { memberId: "mem_marcus", amount: 2000 },
            ],
            date: "2024-02-16",
            createdAt: "2024-02-16T09:00:00.000Z",
            category: "Shopping",
            notes: "Just Olivia and Marcus chipped in for flowers",
          },
        },
      },
      {
        id: "act_birthday_1",
        at: "2024-02-15T20:00:00.000Z",
        actorMemberId: "mem_olivia",
        change: {
          kind: "expense-deleted",
          expense: {
            id: "exp_305",
            description: "Birthday card",
            amount: 599,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_chloe",
            splitType: "equal",
            shares: [
              { memberId: "mem_olivia", amount: 150 },
              { memberId: "mem_ben", amount: 150 },
              { memberId: "mem_chloe", amount: 150 },
              { memberId: "mem_marcus", amount: 149 },
            ],
            date: "2024-02-15",
            createdAt: "2024-02-15T17:00:00.000Z",
            category: "Shopping",
          },
        },
      },
    ],
  },
  grp_camping: {
    startedOn: "2024-03-09",
    entries: [
      {
        id: "act_camping_5",
        at: "2024-03-10T18:30:00.000Z",
        actorMemberId: "mem_jake",
        change: { kind: "category-deleted", category: { id: "cat_camping_gear", name: "Gear rental" } },
      },
      {
        id: "act_camping_4",
        at: "2024-03-09T16:05:00.000Z",
        actorMemberId: "mem_lily",
        change: {
          kind: "category-renamed",
          before: { id: "cat_camping_gear", name: "Gear" },
          after: { id: "cat_camping_gear", name: "Gear rental" },
        },
      },
      {
        id: "act_camping_3",
        at: "2024-03-09T16:00:00.000Z",
        actorMemberId: "mem_jake",
        change: { kind: "category-added", category: { id: "cat_camping_gear", name: "Gear" } },
      },
      {
        id: "act_camping_2",
        at: "2024-03-09T13:00:00.000Z",
        actorMemberId: "mem_omar",
        change: {
          kind: "expense-deleted",
          expense: {
            id: "exp_409",
            description: "Bug spray",
            amount: 899,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_rachel",
            splitType: "equal",
            shares: [
              { memberId: "mem_jake", amount: 180 },
              { memberId: "mem_lily", amount: 180 },
              { memberId: "mem_omar", amount: 180 },
              { memberId: "mem_rachel", amount: 180 },
              { memberId: "mem_dev", amount: 179 },
            ],
            date: "2024-03-09",
            createdAt: "2024-03-09T09:45:00.000Z",
            category: "Other",
          },
        },
      },
      {
        id: "act_camping_1",
        at: "2024-03-09T12:00:00.000Z",
        actorMemberId: "mem_jake",
        change: {
          kind: "expense-edited",
          before: {
            id: "exp_404",
            description: "Gas for the drive",
            amount: 6540,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_jake",
            splitType: "equal",
            shares: [
              { memberId: "mem_jake", amount: 1308 },
              { memberId: "mem_lily", amount: 1308 },
              { memberId: "mem_omar", amount: 1308 },
              { memberId: "mem_rachel", amount: 1308 },
              { memberId: "mem_dev", amount: 1308 },
            ],
            date: "2024-03-09",
            createdAt: "2024-03-09T08:00:00.000Z",
            category: "Transport",
          },
          after: {
            id: "exp_404",
            description: "Gas for the drive",
            amount: 6540,
            currency: "USD",
            lockedRate: "1",
            payerId: "mem_jake",
            splitType: "exact",
            shares: [
              { memberId: "mem_jake", amount: 0 },
              { memberId: "mem_lily", amount: 1635 },
              { memberId: "mem_omar", amount: 1635 },
              { memberId: "mem_rachel", amount: 1635 },
              { memberId: "mem_dev", amount: 1635 },
            ],
            date: "2024-03-09",
            createdAt: "2024-03-09T08:00:00.000Z",
            category: "Transport",
            notes: "Jake drove, so passengers split the gas",
          },
        },
      },
    ],
  },
};

/** The sample Groups with the day their Activity started, and that Activity. */
export function seedGuestSession(groups: GroupSnapshot[]): {
  groups: GroupSnapshot[];
  activity: Record<string, ActivityEntry[]>;
} {
  return {
    groups: groups.map((g) => {
      const sample = SAMPLE_ACTIVITY[g.id];
      return sample ? { ...g, activityStartedOn: sample.startedOn } : g;
    }),
    activity: Object.fromEntries(Object.entries(SAMPLE_ACTIVITY).map(([id, a]) => [id, a.entries])),
  };
}
