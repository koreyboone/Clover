# Spec Delta

## Purpose

Household routines make the next agreed task visible to each participating child and let parents configure the schedule and support without relying on repeated task-by-task reminders.

## ADDED Requirements

### Requirement: Children can see the next routine task
The system SHALL present each participating child with the current routine and the next required task in an age-appropriate format.

#### Scenario: Text-based child views the routine
- **WHEN** a participating child aged 9 or 10 opens the shared display during a scheduled routine
- **THEN** the display shows the routine's required tasks as text and identifies what is next

#### Scenario: Picture-led child views the routine
- **WHEN** the five-year-old opens the shared display during a scheduled routine
- **THEN** the display presents tasks with icons, offers optional audio, and includes no more than one parent-assisted task

### Requirement: Routine interfaces use the shared visual system
The system SHALL use an implemented, documented visual system for both the shared child display and parent interfaces. The child display SHALL be playful, child-centered, and motivating for participating children; parent interfaces SHALL be practical and polished. The visual system SHALL preserve existing routine behavior and authorization boundaries.

#### Scenario: Child uses the shared display
- **WHEN** a child uses a routine screen on the shared display
- **THEN** the screen follows the implemented child-facing visual system and preserves the child's authorized routine interactions

#### Scenario: Parent uses routine controls on a phone
- **WHEN** a parent uses routine controls on a phone
- **THEN** the interface follows the implemented parent-facing visual system and preserves the parent's authorized routine controls

### Requirement: Routine interfaces meet accessibility and viewport criteria
Routine interfaces SHALL meet WCAG 2.2 Level AA contrast: at least 4.5:1 for normal text, 3:1 for large text, and applicable non-text contrast. Interactive controls SHALL be keyboard-operable with visible focus, logical focus order, and accessible names. At supported target viewports, interfaces SHALL have no unintended horizontal overflow or clipped content.

#### Scenario: Routine screen is tested for accessibility and layout
- **WHEN** a routine screen is checked at a supported target viewport
- **THEN** its text and applicable non-text contrast meet WCAG 2.2 Level AA, controls have accessible names and work by keyboard with visible focus and logical focus order, and no content is clipped or causes unintended horizontal overflow

#### Scenario: UI change is reviewed
- **WHEN** a routine interface is added or changed
- **THEN** the change is checked against the implemented visual system, accessibility and viewport criteria, and existing functional behavior

### Requirement: Scheduled routines are highlighted without shaming
The system SHALL highlight a routine when its configured start time arrives without using overdue labels, countdowns, red warning indicators, streaks, or sibling comparisons.

#### Scenario: Routine start time arrives
- **WHEN** a configured routine reaches its scheduled start time
- **THEN** the shared display highlights the routine without an overdue warning or countdown

### Requirement: Children can report task completion
The system SHALL allow a child to mark their own routine tasks complete and show immediate feedback.

#### Scenario: Child completes a task
- **WHEN** a child marks a routine task complete
- **THEN** the task's completion state updates and the child sees immediate feedback

### Requirement: Parents can verify selected tasks
The system SHALL let parents configure whether each task requires parent verification, and verification SHALL be completable in one tap.

#### Scenario: Verification is required
- **WHEN** a child marks a task that requires parent verification complete
- **THEN** the task is shown as awaiting verification until a parent approves it with one tap

#### Scenario: Verification is not required
- **WHEN** a child marks a task that does not require parent verification complete
- **THEN** the task is recorded as complete without parent approval

#### Scenario: Task awaiting verification is not complete
- **WHEN** a task is awaiting parent verification
- **THEN** it is not counted as complete for any routine outcome until a parent approves it

### Requirement: Parents can reject a verification
The system SHALL let a parent reject a child's completion of a verified task, returning it to incomplete without any effort assessment.

#### Scenario: Parent rejects a completion
- **WHEN** a parent rejects a task awaiting verification
- **THEN** the task returns to incomplete and the child can complete it again

### Requirement: Children can request help
The system SHALL let a child indicate that they need help with a task, and the task SHALL count as complete once a parent records that assistance was provided.

#### Scenario: Parent assists with a task
- **WHEN** a child requests help and a parent records that assistance was provided
- **THEN** the task counts as complete without an effort assessment

#### Scenario: Help is requested but not yet recorded
- **WHEN** a child has requested help and no parent has recorded assistance
- **THEN** the task is not counted as complete

### Requirement: Routine requirements stay fixed during an active run
The system SHALL apply edits to required routine tasks only from the next scheduled run, not to a routine already in progress.

#### Scenario: Parent edits a task during a routine
- **WHEN** a parent changes the required tasks while a routine is active
- **THEN** the active run retains its original required tasks and the change applies at the next scheduled run

### Requirement: Parents can configure each child's routine support
The system SHALL let a parent hide or shorten one child's routine without changing another child's routine.

#### Scenario: Parent shortens one child's routine
- **WHEN** a parent hides or shortens tasks for one child
- **THEN** only that child's routine is changed

### Requirement: Parents can skip a routine day
The system SHALL let a parent mark a routine run as skipped for an exception without treating the skipped run as incomplete.

#### Scenario: Parent skips a run
- **WHEN** a parent marks a scheduled run as skipped
- **THEN** the system records an exception and does not treat that run as a child failure

### Requirement: Parents can administer routines from a phone
The system SHALL let a parent configure routine tasks, schedules, task verification, per-child support, and exceptions from a phone interface.

#### Scenario: Parent updates routine settings
- **WHEN** a parent saves routine settings from the phone interface
- **THEN** the settings are available for the applicable routine run without requiring the parent to operate the shared display

### Requirement: Parent actions require parent authorization
The system SHALL restrict parent settings, verification, assistance recording, skip days, and exceptions to authorized parents; children SHALL NOT access them from the shared display.

#### Scenario: Child attempts a parent action
- **WHEN** a child tries to open parent settings or approve a task on the shared display
- **THEN** the system denies the action and makes no change

#### Scenario: Parent performs a parent action
- **WHEN** an authorized parent performs a parent action
- **THEN** the system accepts it
