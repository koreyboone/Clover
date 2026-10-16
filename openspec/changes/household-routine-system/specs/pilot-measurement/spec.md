# Spec Delta

## Purpose

Pilot measurement gives parents a low-effort daily tally that uses the same definitions in baseline and pilot weeks, so changes in parental prompting can be compared reliably.

## ADDED Requirements

### Requirement: Parents can record a daily pilot log
The system SHALL let a parent record per day, per child and routine: direct reminders, board cues, routine completion, conflict occurrences, and parent administration time.

#### Scenario: Parent records the day
- **WHEN** a parent enters a day's tally
- **THEN** each measure is stored for that date, child, and routine

#### Scenario: Reminder is tallied quickly
- **WHEN** a parent records a direct reminder or board cue
- **THEN** it takes a single tap and increments only that measure

### Requirement: Direct reminders and board cues are recorded separately
The system SHALL keep direct reminders (a prompt to one child to start or continue a task) separate from board cues (a general prompt to check the display), using the same definitions in baseline and pilot weeks.

#### Scenario: Both prompt types recorded
- **WHEN** a parent records a direct reminder and a board cue on the same day
- **THEN** the log shows them as separate counts

#### Scenario: Baseline week
- **WHEN** the log is used in week 0 before the display is in use
- **THEN** the board cue count is zero and direct reminders are recorded with the same definition used later

### Requirement: Parents can review the pilot log
The system SHALL show a parent the logged measures by week for comparison, without sibling rankings, and SHALL NOT calculate automatic adjustments to routines.

#### Scenario: Parent reviews weeks
- **WHEN** a parent opens the review
- **THEN** reminders, board cues, completion, conflicts, and administration time are shown by week and child

### Requirement: Pilot log data is held with household data
The pilot log SHALL be stored, exported, restored, and deleted with the household's other data and SHALL NOT be sent to analytics services.

#### Scenario: Export includes the log
- **WHEN** a parent exports household data
- **THEN** the pilot log is included
