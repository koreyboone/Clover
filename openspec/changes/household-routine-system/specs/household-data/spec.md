# Spec Delta

## Purpose

Household data keeps each family's routine and reward information in a single authoritative, access-controlled store shared by the display and parent devices, with parent-only accounts, no child accounts, and parent-controlled export and deletion.

## ADDED Requirements

### Requirement: Household data has a single authoritative store
The system SHALL keep each household's routine, completion, verification, reward, and pilot data in one authoritative store that the display and parent devices read and write through.

#### Scenario: Change made on a parent device
- **WHEN** a parent saves a change on a parent device
- **THEN** the shared display shows the change after its next refresh without any action on the display

#### Scenario: Child action on the display
- **WHEN** a child completes a task on the display
- **THEN** the action is stored and visible to parents on their devices

### Requirement: Only authenticated parents hold accounts
The system SHALL provide accounts only for parents, SHALL NOT provide child accounts, and SHALL give the shared display a restricted device session that can perform only child-facing actions.

#### Scenario: Parent signs in
- **WHEN** a parent signs in on a phone
- **THEN** the parent can use parent functions for their household

#### Scenario: Display session attempts a parent action
- **WHEN** the display session attempts a parent function such as changing settings or approving a task
- **THEN** the system denies it and changes nothing

### Requirement: Household data is isolated and authorization is enforced by the store
The system SHALL enforce access limits on the server or database, not only in the user interface, so a user or device can read and change only its own household's data within its role, and service credentials SHALL NOT be exposed to browsers.

#### Scenario: Cross-household access
- **WHEN** a signed-in user requests another household's data
- **THEN** the system returns no data and makes no change

#### Scenario: Interface controls are bypassed
- **WHEN** a request for a parent function is sent directly without parent authorization
- **THEN** the system rejects it

### Requirement: Display shows a stale read-only view when disconnected
The shared display SHALL keep showing its last successfully loaded data when the connection is lost, SHALL show when it last synchronized, and SHALL NOT accept changes while disconnected.

#### Scenario: Connection is lost
- **WHEN** the display loses its connection
- **THEN** it keeps showing the last loaded routine, shows the last synchronization time, and disables actions that change data

#### Scenario: Connection returns
- **WHEN** the display reconnects
- **THEN** it refreshes from the authoritative store and re-enables actions

### Requirement: Repeated actions are applied once
The system SHALL apply each child action, parent action, point change, and reward transition at most once even if the request is submitted repeatedly or concurrently.

#### Scenario: Request retried
- **WHEN** the same action is submitted twice
- **THEN** its effect is applied once

#### Scenario: Concurrent requests
- **WHEN** two requests would together spend more than a child's available balance
- **THEN** at most the affordable requests succeed

### Requirement: Household data is processed by approved services only
The system SHALL store and process children's data only in the services chosen to host the application and its database, SHALL NOT send it to language models, and SHALL NOT use third-party analytics or advertising.

#### Scenario: Normal use
- **WHEN** children and parents use the system
- **THEN** no household data is sent to a language model or analytics service

### Requirement: Parents can export household data
The system SHALL let a parent export the household's routines, reward configuration, balances, point ledger, and pilot records in a documented format.

#### Scenario: Parent exports data
- **WHEN** a parent requests an export
- **THEN** the system provides the household's data in the documented format

### Requirement: Parents can delete household data
The system SHALL let a parent delete the household's data after explicit confirmation, SHALL state what happens to provider-held backups and copies, and SHALL NOT allow the display or any child function to delete data.

#### Scenario: Parent confirms deletion
- **WHEN** a parent confirms deletion
- **THEN** the household's data is removed from the store and the parent is told how provider-held copies are handled

#### Scenario: Deletion not confirmed
- **WHEN** a parent starts deletion but does not confirm
- **THEN** no data is deleted

### Requirement: Household data can be restored from an export
The system SHALL validate an exported file completely before replacing household data, SHALL keep the previous data recoverable if restoration fails, and SHALL reject unsupported versions without changing current data.

#### Scenario: Valid export restored
- **WHEN** a parent restores a valid export and confirms
- **THEN** the household's data is replaced with the export's data

#### Scenario: Invalid or unsupported export
- **WHEN** a parent restores a damaged or unsupported export
- **THEN** the system reports failure and leaves current data unchanged

#### Scenario: Restore fails partway
- **WHEN** a restore fails before completing
- **THEN** the previous data remains in effect
