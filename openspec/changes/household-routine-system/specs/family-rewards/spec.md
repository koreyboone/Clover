# Spec Delta

## Purpose

Family rewards provide transparent, predictable recognition for routine completion and optional contributions while keeping expected responsibilities separate from earned rewards.

## ADDED Requirements

### Requirement: Routine bonuses follow a fixed decision sequence
The system SHALL determine a run's bonus in this order: full if zero required tasks are incomplete; otherwise partial if the incomplete count is at or below the configured limit; otherwise none. Incomplete runs SHALL NOT deduct points.

#### Scenario: All required tasks are complete
- **WHEN** all required tasks in a routine run are complete
- **THEN** the child receives the configured full bonus

#### Scenario: Incomplete count is within the limit
- **WHEN** at least one task is incomplete and the incomplete count is at or below the configured limit
- **THEN** the child receives the configured partial bonus

#### Scenario: Incomplete count exceeds the limit
- **WHEN** the incomplete count is above the configured limit
- **THEN** the child receives no routine bonus and loses no points

#### Scenario: Parent assistance completes a task
- **WHEN** a required task is completed with recorded parent assistance
- **THEN** it counts as complete when determining the routine bonus

#### Scenario: Task awaits verification at completion
- **WHEN** a task is still awaiting parent verification when the bonus is determined
- **THEN** it counts as incomplete until approved

#### Scenario: Routine has no required tasks
- **WHEN** a routine run has zero required tasks
- **THEN** no routine bonus is awarded

#### Scenario: Routine run is skipped
- **WHEN** a parent skips the routine run for an exception
- **THEN** no routine bonus is awarded and no points are deducted

#### Scenario: Bonus is not applied twice
- **WHEN** bonus determination is retried for the same run
- **THEN** the child's points are awarded at most once

### Requirement: Routine bonus values are configurable and validated
The system SHALL let a parent configure full and partial bonus values and an integer limit L of incomplete tasks allowed for a partial bonus, where 0 <= L < N and N is the number of required tasks. The default limit SHALL be 1 when valid.

#### Scenario: Parent changes bonus rules
- **WHEN** a parent saves new routine bonus values or a partial limit
- **THEN** the saved rules apply to subsequent eligible routine runs

#### Scenario: Invalid limit on save
- **WHEN** a parent saves a limit that is not an integer, is negative, or is not less than the routine's task count
- **THEN** the system rejects the change and keeps the existing rules

#### Scenario: Limit invalid when a run is created
- **WHEN** a run is created and the saved limit is no longer valid for the routine's tasks
- **THEN** the system does not create the run with that limit and prompts a parent to correct it

### Requirement: Optional contributions earn parent-set points
The system SHALL let a parent offer optional contributions with fixed point values and age-appropriate availability per child. A child's report of completing one SHALL require parent confirmation by default before points are awarded.

#### Scenario: Child completes an optional contribution
- **WHEN** a child reports an optional contribution and a parent confirms it
- **THEN** the child earns the contribution's fixed point value once

#### Scenario: Contribution awarded only once
- **WHEN** the same reported contribution is confirmed more than once
- **THEN** the points are awarded at most once

### Requirement: Children can see balances and available rewards
The system SHALL show each child their current point balance, the reward catalog, and their progress toward available rewards.

#### Scenario: Child views rewards
- **WHEN** a child opens the rewards view
- **THEN** the view shows that child's balance, available rewards, and progress toward each reward

### Requirement: Rewards are instant or need approval
The system SHALL let a parent mark each reward as `instant` or `needs approval`.

#### Scenario: Parent sets reward type
- **WHEN** a parent saves a reward with a type
- **THEN** redemptions of that reward follow that type

### Requirement: Instant redemption updates the balance visibly
The system SHALL let a child redeem an eligible instant reward and immediately show the corresponding point deduction.

#### Scenario: Child redeems an instant reward
- **WHEN** a child redeems an instant reward costing no more than their available balance
- **THEN** the reward is recorded and the child's balance is immediately reduced by its cost

#### Scenario: Reward costs more than the balance
- **WHEN** a child attempts to redeem a reward costing more than their available balance
- **THEN** the redemption is not completed and the balance remains unchanged

### Requirement: Approval-required redemptions reserve points
The system SHALL reserve the points when a child requests a needs-approval reward, excluding them from the available balance until a parent approves or declines. Approval SHALL finalize the deduction; declining SHALL release the reservation without deducting points.

#### Scenario: Child requests an approval-required reward
- **WHEN** a child requests a needs-approval reward costing no more than their available balance
- **THEN** the points are reserved and the request is shown as pending

#### Scenario: Pending request prevents double spending
- **WHEN** reserved points leave too little available balance for another redemption
- **THEN** the second redemption is not completed

#### Scenario: Parent approves
- **WHEN** a parent approves a pending request
- **THEN** the reservation becomes a final deduction

#### Scenario: Parent declines
- **WHEN** a parent declines a pending request
- **THEN** the reservation is released and no points are deducted

#### Scenario: Transitions are retried
- **WHEN** a request, approval, or decline is submitted more than once
- **THEN** the points are reserved, charged, or released at most once

### Requirement: Parents can administer rewards
The system SHALL let a parent manage reward catalog entries, their point costs, optional contributions, and their point values from a phone interface.

#### Scenario: Parent updates a reward
- **WHEN** a parent saves a reward catalog or contribution change from the phone interface
- **THEN** the updated entry is available to the applicable child without changing other children's balances
