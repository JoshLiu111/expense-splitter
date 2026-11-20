/**
 * Tells people they were added to a Group by email, on behalf of the User
 * adding them. Guests get no notifier: adding a Member never sends email.
 */
export interface MemberNotifier {
  /** The name of the User adding Members, to say who added them. */
  inviterName: string;
  /**
   * A Pending Member was issued an Invitation: email it to them, with the
   * link carrying `token`.
   */
  invited?(args: {
    groupId: string;
    groupName: string;
    memberId: string;
    email: string;
    inviterName: string;
    token: string;
  }): Promise<void>;
  /** An existing User was linked as a Member: tell them, with a link to the Group. */
  added?(args: { groupId: string; groupName: string; email: string; inviterName: string }): Promise<void>;
}
