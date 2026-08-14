import {act, fireEvent, render, screen, within} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import {KeyboardStateProvider} from '@components/withKeyboardState';

import useResponsiveLayout from '@hooks/useResponsiveLayout';

import type {ReportActionComposeProps} from '@pages/inbox/report/ReportActionCompose/ReportActionCompose';
import ReportActionCompose from '@pages/inbox/report/ReportActionCompose/ReportActionCompose';
import useEditMessage from '@pages/inbox/report/ReportActionCompose/useEditMessage';
import {ReportActionEditMessageContextProvider} from '@pages/inbox/report/ReportActionEditMessageContext';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

import type * as NativeNavigation from '@react-navigation/native';
import type {PropsWithChildren} from 'react';

import React, {useRef} from 'react';
import Onyx from 'react-native-onyx';

import * as LHNTestUtils from '../utils/LHNTestUtils';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

/**
 * Repro harness for https://github.com/Expensify/App/issues/98580
 * "Edited comment remains in composer after saving" (narrow layout / iOS App).
 */

jest.mock('@hooks/useResponsiveLayout', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const narrowLayout = {
    shouldUseNarrowLayout: true,
    isSmallScreenWidth: true,
    isInNarrowPaneModal: false,
    isExtraSmallScreenHeight: false,
    isExtraSmallScreenWidth: false,
    isMediumScreenWidth: false,
    onboardingIsMediumOrLargerScreenWidth: false,
    isLargeScreenWidth: false,
    isSmallScreen: true,
} as ReturnType<typeof useResponsiveLayout>;

jest.mock('@libs/getPlatform', () => ({
    __esModule: true,
    default: () => 'web',
}));

jest.mock('@libs/ComponentUtils', () => ({
    forceClearInput: jest.fn(),
}));

jest.mock('@hooks/useLocalize', () =>
    jest.fn(() => ({
        translate: jest.fn((key: string) => key),
        numberFormat: jest.fn((num: number) => num.toString()),
    })),
);

jest.mock('@hooks/usePaginatedReportActions', () => jest.fn(() => ({reportActions: [], hasNewerActions: false, hasOlderActions: false})));
jest.mock('@hooks/useParentReportAction', () => jest.fn(() => null));
jest.mock('@hooks/useReportTransactionsCollection', () => jest.fn(() => ({})));
jest.mock('@hooks/useShortMentionsList', () => jest.fn(() => ({availableLoginsList: []})));
jest.mock('@hooks/useSidePanelState', () => jest.fn(() => ({sessionStartTime: null})));
jest.mock('@hooks/useCardFeedsForDisplay', () => jest.fn(() => ({defaultCardFeed: null, cardFeedsByPolicy: {}})));

jest.mock('@libs/actions/Report', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actual = jest.requireActual('@libs/actions/Report');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        ...actual,
        editReportComment: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        saveReportActionDraft: jest.fn((...args: any[]) => {
            // eslint-disable-next-line no-console
            console.log('[spy] saveReportActionDraft fired with:', JSON.stringify(args.at(-1)), 'at t=', Date.now(), '\n', new Error('trace').stack?.split('\n').slice(1, 8).join('\n'));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            return actual.saveReportActionDraft(...args);
        }),
        clearAllReportActionDrafts: jest.fn(() => {
            // eslint-disable-next-line no-console
            console.log('[spy] clearAllReportActionDrafts');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return actual.clearAllReportActionDrafts();
        }),
    };
});

jest.mock('@components/DropZone/DualDropZone', () => {
    const RN = jest.requireActual<Record<string, React.ComponentType<{testID?: string; children?: React.ReactNode}>>>('react-native');
    return () => <RN.Text testID="dual-drop-zone" />;
});

const mockRouteReportID = {current: '1'};

jest.mock('@react-navigation/native', () => ({
    ...((): typeof NativeNavigation => {
        return jest.requireActual('@react-navigation/native');
    })(),
    useNavigation: jest.fn(() => ({
        navigate: jest.fn(),
        addListener: jest.fn(() => jest.fn()),
    })),
    useIsFocused: jest.fn(() => true),
    useRoute: jest.fn(() => ({key: '', name: '', params: {reportID: mockRouteReportID.current}})),
}));

TestHelper.setupGlobalFetchMock();

const mockUseResponsiveLayout = jest.mocked(useResponsiveLayout);

const defaultReport = LHNTestUtils.getFakeReport();
mockRouteReportID.current = defaultReport.reportID;

const commentAction: OnyxTypes.ReportAction = {
    ...LHNTestUtils.getFakeReportAction(),
    actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
};

const secondCommentAction: OnyxTypes.ReportAction = {
    ...LHNTestUtils.getFakeReportAction(),
    reportActionID: `${Number(commentAction.reportActionID) + 1}`,
    actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
};

const defaultProps: ReportActionComposeProps = {
    reportID: defaultReport.reportID,
};

const testIds = CONST.COMPOSER.TEST_ID;

const ORIGINAL_MESSAGE = 'Hello [attachment](https://example.com/a.png)';
const EDITED_MESSAGE = 'Hello [attachment](https://example.com/b.png)';

/** Mirrors the real Save button: it calls `publishDraft` from `useEditMessage` (via useComposerSubmit). */
const publishDraftRef: {current: ((draft: string) => void) | null} = {current: null};

function SaveButtonHarness() {
    const composerRef = useRef(null);
    const {publishDraft} = useEditMessage({
        reportID: defaultReport.reportID,
        originalReportID: defaultReport.reportID,
        reportAction: commentAction,
        debouncedCommentMaxLengthValidation: {flush: () => true} as never,
        composerRef,
    });
    publishDraftRef.current = publishDraft;
    return null;
}

function ReportActionEditMessageContextProviderForReport({children}: PropsWithChildren) {
    return <ReportActionEditMessageContextProvider reportID={defaultReport.reportID}>{children}</ReportActionEditMessageContextProvider>;
}

function renderNarrowComposeWithSaveButton() {
    mockUseResponsiveLayout.mockReturnValue(narrowLayout);
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider, KeyboardStateProvider, ReportActionEditMessageContextProviderForReport]}>
            <ReportActionCompose {...defaultProps} />
            <SaveButtonHarness />
        </ComposeProviders>,
    );
}

async function seedReportActionsAndEditDraft() {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${defaultReport.reportID}`, defaultReport);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${defaultReport.reportID}`, {
            [commentAction.reportActionID]: commentAction,
        });
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS, {
            [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${defaultReport.reportID}`]: {
                [commentAction.reportActionID]: {message: ORIGINAL_MESSAGE},
            },
        });
    });
}

async function getPersistedDraftMessage(reportActionID: string = commentAction.reportActionID) {
    let draftMessage: string | undefined;
    await TestHelper.getOnyxData({
        key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${defaultReport.reportID}`,
        callback: (drafts) => {
            draftMessage = drafts?.[reportActionID]?.message;
        },
    });
    return draftMessage;
}

function getComposerValue() {
    const mainRoot = screen.getByTestId(testIds.REPORT_ACTION_COMPOSE);
    return within(mainRoot).getByTestId(CONST.COMPOSER.NATIVE_ID).props.value as string;
}

function isInEditMode() {
    return screen.queryByTestId(testIds.EDITING_MESSAGE_ACTION_ROW) !== null;
}

/**
 * `waitForBatchedUpdates` calls `jest.runOnlyPendingTimers()` under fake timers, which would fire the pending
 * 1000ms draft debounce we are trying to keep in flight. This flushes React/Onyx work without touching timers.
 */
async function flushWithoutRunningTimers() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function advanceTimers(ms: number) {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
    await flushWithoutRunningTimers();
}

describe('#98580 edited comment remains in composer after saving (narrow layout)', () => {
    beforeAll(() => {
        Onyx.init({
            keys: ONYXKEYS,
            evictableKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        });
    });

    beforeEach(() => {
        mockUseResponsiveLayout.mockReturnValue(narrowLayout);
        mockRouteReportID.current = defaultReport.reportID;
        jest.useFakeTimers();
    });

    afterEach(async () => {
        jest.useRealTimers();
        publishDraftRef.current = null;
        await act(async () => {
            await Onyx.clear();
        });
    });

    it('REPRO: Save less than 1s after the last keystroke leaves the edited text in the composer', async () => {
        await seedReportActionsAndEditDraft();
        await waitForBatchedUpdatesWithAct();

        renderNarrowComposeWithSaveButton();
        await waitForBatchedUpdatesWithAct();

        expect(isInEditMode()).toBe(true);
        expect(getComposerValue()).toBe(ORIGINAL_MESSAGE);

        // 1. User edits the attachment link -> schedules the 1000ms debounced saveReportActionDraft
        const mainRoot = screen.getByTestId(testIds.REPORT_ACTION_COMPOSE);
        fireEvent.changeText(within(mainRoot).getByTestId(CONST.COMPOSER.NATIVE_ID), EDITED_MESSAGE);
        await flushWithoutRunningTimers();

        // 2. ~282ms later (the timing measured in the issue thread) the user taps Save
        await advanceTimers(282);
        await act(async () => {
            publishDraftRef.current?.(EDITED_MESSAGE);
        });
        await flushWithoutRunningTimers();

        // 3. Right after Save the draft is cleared and the composer is restored correctly
        expect(await getPersistedDraftMessage()).toBeUndefined();
        // eslint-disable-next-line no-console
        console.log('[repro] right after Save -> editMode:', isInEditMode(), '| composer value:', JSON.stringify(getComposerValue()));

        // 4. The trailing debounced save fires ~718ms after the clear
        await advanceTimers(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME);

        // eslint-disable-next-line no-console
        console.log(
            '[repro] after the trailing debounce -> editMode:',
            isInEditMode(),
            '| composer value:',
            JSON.stringify(getComposerValue()),
            '| persisted draft:',
            JSON.stringify(await getPersistedDraftMessage()),
        );

        expect(await getPersistedDraftMessage()).toBe(EDITED_MESSAGE);
        expect(isInEditMode()).toBe(true);
        expect(getComposerValue()).toBe(EDITED_MESSAGE);
    });

    it('HOLE: starting to edit another message inside the 1s window (differentiates an editingState guard from a real cancel)', async () => {
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${defaultReport.reportID}`, {
                [secondCommentAction.reportActionID]: secondCommentAction,
            });
        });
        await seedReportActionsAndEditDraft();
        await waitForBatchedUpdatesWithAct();

        renderNarrowComposeWithSaveButton();
        await waitForBatchedUpdatesWithAct();

        const mainRoot = screen.getByTestId(testIds.REPORT_ACTION_COMPOSE);
        fireEvent.changeText(within(mainRoot).getByTestId(CONST.COMPOSER.NATIVE_ID), EDITED_MESSAGE);
        await flushWithoutRunningTimers();

        await advanceTimers(282);
        await act(async () => {
            publishDraftRef.current?.(EDITED_MESSAGE);
        });
        await flushWithoutRunningTimers();

        // The user immediately starts editing a *different* message, still inside the 1s debounce window
        await act(async () => {
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS, {
                [`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_DRAFTS}${defaultReport.reportID}`]: {
                    [secondCommentAction.reportActionID]: {message: 'Second message'},
                },
            });
        });
        await flushWithoutRunningTimers();
        expect(isInEditMode()).toBe(true);
        expect(getComposerValue()).toBe('Second message');

        // The trailing save from the *previous* edit session fires
        await advanceTimers(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME);

        // eslint-disable-next-line no-console
        console.log(
            '[hole] after the trailing debounce -> composer value:',
            JSON.stringify(getComposerValue()),
            '| draft(action1):',
            JSON.stringify(await getPersistedDraftMessage()),
            '| draft(action2):',
            JSON.stringify(await getPersistedDraftMessage(secondCommentAction.reportActionID)),
        );

        expect(await getPersistedDraftMessage()).toBeUndefined();
        expect(await getPersistedDraftMessage(secondCommentAction.reportActionID)).toBe('Second message');
        expect(getComposerValue()).toBe('Second message');
    });

    it('CONTROL: Save more than 1s after the last keystroke closes edit mode and clears the composer', async () => {
        await seedReportActionsAndEditDraft();
        await waitForBatchedUpdatesWithAct();

        renderNarrowComposeWithSaveButton();
        await waitForBatchedUpdatesWithAct();

        const mainRoot = screen.getByTestId(testIds.REPORT_ACTION_COMPOSE);
        fireEvent.changeText(within(mainRoot).getByTestId(CONST.COMPOSER.NATIVE_ID), EDITED_MESSAGE);
        await waitForBatchedUpdatesWithAct();

        // The debounce fires *before* Save, so no write is left pending
        await act(async () => {
            jest.advanceTimersByTime(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME + 100);
        });
        await waitForBatchedUpdatesWithAct();
        expect(await getPersistedDraftMessage()).toBe(EDITED_MESSAGE);

        await act(async () => {
            publishDraftRef.current?.(EDITED_MESSAGE);
        });
        await waitForBatchedUpdatesWithAct();

        await act(async () => {
            jest.advanceTimersByTime(CONST.TIMING.DRAFT_SAVE_DEBOUNCE_TIME);
        });
        await waitForBatchedUpdatesWithAct();

        // eslint-disable-next-line no-console
        console.log(
            '[control] after Save -> editMode:',
            isInEditMode(),
            '| composer value:',
            JSON.stringify(getComposerValue()),
            '| persisted draft:',
            JSON.stringify(await getPersistedDraftMessage()),
        );

        expect(await getPersistedDraftMessage()).toBeUndefined();
        expect(isInEditMode()).toBe(false);
    });
});
