import {act, renderHook} from '@testing-library/react-native';

import useConciergeSidePanelReportActions from '@hooks/useConciergeSidePanelReportActions';

import {getServerAnchoredDBTime} from '@libs/NetworkState';

import {ConciergeSessionProvider, useConciergeSessionActions, useConciergeSessionState} from '@pages/inbox/ConciergeSessionContext';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import createRandomReportAction from '../../utils/collections/reportActions';
import {createRandomReport} from '../../utils/collections/reports';
import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

const REPORT_ID = '1';
const CURRENT_USER_ACCOUNT_ID = 1;
const CONCIERGE_ACCOUNT_ID = 2;

/** Shifts a DB-time string by the given number of milliseconds. */
function addMs(dbTime: string, ms: number): string {
    return new Date(new Date(`${dbTime}Z`).valueOf() + ms).toISOString().replace('T', ' ').replace('Z', '');
}

function buildAction(reportActionID: string, overrides: Partial<ReportAction>): ReportAction {
    return {
        ...createRandomReportAction(Number(reportActionID)),
        reportActionID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        pendingAction: undefined,
        ...overrides,
    };
}

/** Renders the app-level Concierge session provider and exposes its state plus actions. */
async function renderSession() {
    const rendered = renderHook(
        () => {
            const {sessionStartTime} = useConciergeSessionState();
            const {startSession, restartSession} = useConciergeSessionActions();
            return {sessionStartTime, startSession, restartSession};
        },
        {wrapper: ConciergeSessionProvider},
    );
    // Flush the provider's Onyx session read so later state updates aren't reported outside act().
    await act(async () => {
        await waitForBatchedUpdates();
    });
    return rendered;
}

/**
 * The conversation from the attached recording: the DM is opened (session boundary), Concierge greets the user,
 * then the user asks a question and gets a reply — all after the boundary, inside the same active session.
 */
function buildRecordedHistory(boundary: string) {
    return {
        createdAction: buildAction('10', {actionName: CONST.REPORT.ACTIONS.TYPE.CREATED, created: addMs(boundary, -60_000)}),
        welcome: buildAction('11', {actorAccountID: CONCIERGE_ACCOUNT_ID, created: addMs(boundary, 1_000)}),
        priorQuestion: buildAction('12', {created: addMs(boundary, 60_000)}),
        priorReply: buildAction('13', {actorAccountID: CONCIERGE_ACCOUNT_ID, created: addMs(boundary, 65_000)}),
    };
}

function renderMainDM({sessionStartTime, reportActions, showFullHistory = false}: {sessionStartTime: string | null; reportActions: ReportAction[]; showFullHistory?: boolean}) {
    const report: Report = {...createRandomReport(Number(REPORT_ID)), reportID: REPORT_ID, lastReadTime: sessionStartTime ?? undefined};

    return renderHook(() =>
        useConciergeSidePanelReportActions({
            report,
            reportActions,
            visibleReportActions: reportActions,
            isConciergeHiddenHistory: true,
            hasUserSentMessage: true,
            hasOlderActions: false,
            sessionStartTime,
            currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
            greetingText: 'Hi there, how can I help?',
            loadOlderChats: jest.fn(),
            isConciergeMainDM: true,
            showFullHistory,
        }),
    );
}

describe('Concierge main DM session boundary on an explicit ask', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows the whole history with no "Show history" button when an ask inherits the boundary of an active session', async () => {
        // Given a session created when the Concierge DM was opened, and a conversation that followed inside it
        const session = await renderSession();
        act(() => session.result.current.startSession());
        const openBoundary = session.result.current.sessionStartTime;
        const {createdAction, welcome, priorQuestion, priorReply} = buildRecordedHistory(openBoundary ?? '');

        // When "Ask Concierge" navigates back into the still-mounted DM, the refocus effect re-fires with the
        // unread anchor — the only writer of the boundary, and it never moves it forward
        act(() => session.result.current.startSession(priorQuestion.created));
        expect(session.result.current.sessionStartTime).toBe(openBoundary);

        // Then the new question is in-session together with the whole prior conversation
        const question = buildAction('20', {created: addMs(priorReply.created, 5_000), pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD});
        const {result} = renderMainDM({sessionStartTime: session.result.current.sessionStartTime, reportActions: [createdAction, welcome, priorQuestion, priorReply, question]});
        const visibleIDs = result.current.filteredReportActions.map((action) => action.reportActionID);

        // ...so nothing is hidden and the "Show history" button has nothing to reveal — the reported bug
        expect(visibleIDs).toEqual(expect.arrayContaining(['11', '12', '13', '20']));
        expect(result.current.hasPreviousMessages).toBe(false);
    });

    it('hides the prior conversation and renders "Show history" when the ask restarts the session', async () => {
        // Given the same active session and conversation
        const session = await renderSession();
        act(() => session.result.current.startSession());
        const openBoundary = session.result.current.sessionStartTime;
        const {createdAction, welcome, priorQuestion, priorReply} = buildRecordedHistory(openBoundary ?? '');

        // When the explicit ask restarts the session, clamped after the report's newest action
        act(() => session.result.current.restartSession(priorReply.created));
        const askBoundary = session.result.current.sessionStartTime ?? '';
        expect(askBoundary > priorReply.created).toBe(true);

        // ...and the refocus effect still re-fires with the stale unread anchor
        act(() => session.result.current.startSession(priorQuestion.created));
        expect(session.result.current.sessionStartTime).toBe(askBoundary);

        // Then the question addComment stamps with the same floor is in-session, and the history is not
        const question = buildAction('20', {created: getServerAnchoredDBTime('', priorReply.created)});
        const {result} = renderMainDM({sessionStartTime: askBoundary, reportActions: [createdAction, welcome, priorQuestion, priorReply, question]});
        const visibleIDs = result.current.filteredReportActions.map((action) => action.reportActionID);

        expect(visibleIDs).toContain('20');
        expect(visibleIDs).not.toContain('11');
        expect(visibleIDs).not.toContain('12');
        expect(visibleIDs).not.toContain('13');
        expect(result.current.hasPreviousMessages).toBe(true);
    });

    it('still pulls an auto-started session back to a genuinely unread anchor', async () => {
        // Given an auto-started session (opening the DM), which can lock to `now` before the anchor resolves
        const session = await renderSession();
        act(() => session.result.current.startSession());
        const unreadBoundary = addMs(session.result.current.sessionStartTime ?? '', -30_000);

        // When the unread anchor arrives afterwards
        act(() => session.result.current.startSession(unreadBoundary));

        // Then the boundary is still refined backwards so the unread message stays visible
        expect(session.result.current.sessionStartTime).toBe(unreadBoundary);
    });

    it('applies the pull-back again once an explicitly started session has expired', async () => {
        const session = await renderSession();
        const nowSpy = jest.spyOn(Date, 'now');
        const sessionCreatedAt = Date.now();

        // Given an explicitly started session
        nowSpy.mockReturnValue(sessionCreatedAt);
        act(() => session.result.current.restartSession());

        // When it expires and the DM is opened again with an unread anchor
        nowSpy.mockReturnValue(sessionCreatedAt + CONST.CONCIERGE_SESSION_EXPIRATION_MS + 1);
        const unreadBoundary = addMs(session.result.current.sessionStartTime ?? '', -30_000);
        act(() => session.result.current.startSession(unreadBoundary));

        // Then the fresh auto session is refined backwards again — the exemption doesn't outlive the session
        expect(session.result.current.sessionStartTime).toBe(unreadBoundary);
    });

    it('keeps the whole history visible when showFullHistory is forced, even with a correct boundary', async () => {
        // Given the ask restarted the session, but the main DM forces full history (hasOutstandingChildTask)
        const session = await renderSession();
        act(() => session.result.current.startSession());
        const {createdAction, welcome, priorQuestion, priorReply} = buildRecordedHistory(session.result.current.sessionStartTime ?? '');
        act(() => session.result.current.restartSession(priorReply.created));
        const question = buildAction('20', {created: getServerAnchoredDBTime('', priorReply.created)});

        // When the actions are filtered
        const {result} = renderMainDM({
            sessionStartTime: session.result.current.sessionStartTime,
            reportActions: [createdAction, welcome, priorQuestion, priorReply, question],
            showFullHistory: true,
        });
        const visibleIDs = result.current.filteredReportActions.map((action) => action.reportActionID);

        // Then the boundary fix alone can't hide anything — a forced showFullHistory is a separate cause
        expect(visibleIDs).toEqual(expect.arrayContaining(['11', '12', '13', '20']));
        expect(result.current.showFullHistory).toBe(true);
    });
});
