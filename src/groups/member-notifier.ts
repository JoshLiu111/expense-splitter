/**
 * Tells people they were added to a Group by email, on behalf of the User
 * adding them, who the notifier names. Guests get no notifier: adding a
 * Member never sends email.
 */
export interface MemberNotifier {
  /**
   * A Pending Member was issued an Invitation: email it to them, with the
   * link carrying `token`.
   */
  invited(args: { groupId: string; groupName: string; email: string; token: string }): Promise<void>;
  /** An existing User was linked as a Member: tell them, with a link to the Group. */
  added(args: { groupId: string; groupName: string; email: string }): Promise<void>;
}
