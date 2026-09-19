import {act, renderHook} from '@testing-library/react-native';

import useReviewWorkspaceSettingsTaskCompletion from '@hooks/useReviewWorkspaceSettingsTaskCompletion';

import {getGuidedSetupDataForOpenReport} from '@libs/actions/Report';
import type {GuidedSetupTask} from '@libs/actions/Report';

import CONST from '@src/CONST';
import IntlStore from '@src/languages/IntlStore';
import ONYXKEYS from '@src/ONYXKEYS';
import type {IntroSelected, Report} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import getOnyxValue from '../../utils/getOnyxValue';
import {isGuidedSetupTask, parseJSONArray} from '../../utils/typeGuards';
import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../../utils/waitForBatchedUpdatesWithAct';

const CURRENT_USER_ACCOUNT_ID = 1;
const TASK_REPORT_ID = '100';
const CONCIERGE_REPORT_ID = '200';

jest.mock('@hooks/useCurrentUserPersonalDetails', () => ({
    __esModule: true,
    default: jest.fn(() => ({accountID: CURRENT_USER_ACCOUNT_ID})),
}));

describe('useReviewWorkspaceSettingsTaskCompletion', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await Onyx.clear();
        await IntlStore.load(CONST.LOCALES.DEFAULT);
        await waitForBatchedUpdates();
    });

    it('remembers the review when the task has not been created yet', async () => {
        await Onyx.merge(ONYXKEYS.NVP_INTRO_SELECTED, {choice: CONST.ONBOARDING_CHOICES.ADMIN, isInviteOnboardingComplete: false});
        await waitForBatchedUpdates();

        const {result} = renderHook(() => useReviewWorkspaceSettingsTaskCompletion());
        await waitForBatchedUpdatesWithAct();

        let completionData;
        await act(async () => {
            completionData = result.current();
            await waitForBatchedUpdates();
        });

        expect(completionData).toEqual({});
        const onboarding = await getOnyxValue(ONYXKEYS.NVP_ONBOARDING);
        expect(onboarding?.reviewedWorkspaceSettings).toBe(true);
    });

    it('creates the task already completed when guided setup runs after the review', async () => {
        const introSelected: IntroSelected = {
            choice: CONST.ONBOARDING_CHOICES.ADMIN,
            inviteType: CONST.ONBOARDING_INVITE_TYPES.WORKSPACE,
            isInviteOnboardingComplete: false,
        };
        await Onyx.merge(ONYXKEYS.NVP_INTRO_SELECTED, introSelected);
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});
        await waitForBatchedUpdates();

        const {result} = renderHook(() => useReviewWorkspaceSettingsTaskCompletion());
        await waitForBatchedUpdatesWithAct();

        await act(async () => {
            result.current();
            await waitForBatchedUpdates();
        });

        // Opening Concierge afterwards builds the invited admin's checklist for the OpenReport request
        const guidedSetup = getGuidedSetupDataForOpenReport(introSelected, CURRENT_USER_ACCOUNT_ID, {reportID: CONCIERGE_REPORT_ID});
        const guidedSetupData = parseJSONArray(guidedSetup?.guidedSetupData, 'guidedSetupData');
        const reviewWorkspaceSettingsTask = guidedSetupData.find(
            (item): item is GuidedSetupTask => isGuidedSetupTask(item) && item.task === CONST.ONBOARDING_TASK_TYPE.REVIEW_WORKSPACE_SETTINGS,
        );
        expect(reviewWorkspaceSettingsTask).toBeDefined();
        expect(reviewWorkspaceSettingsTask?.completedTaskReportActionID).toBeDefined();
    });

    it('does not remember the review when the task already exists', async () => {
        const taskReport: Report = {
            reportID: TASK_REPORT_ID,
            type: CONST.REPORT.TYPE.TASK,
            ownerAccountID: CURRENT_USER_ACCOUNT_ID,
            managerID: CURRENT_USER_ACCOUNT_ID,
            stateNum: CONST.REPORT.STATE_NUM.OPEN,
            statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        };
        await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${TASK_REPORT_ID}`, taskReport);
        await Onyx.merge(ONYXKEYS.NVP_INTRO_SELECTED, {choice: CONST.ONBOARDING_CHOICES.ADMIN, reviewWorkspaceSettings: TASK_REPORT_ID});
        await waitForBatchedUpdates();

        const {result} = renderHook(() => useReviewWorkspaceSettingsTaskCompletion());
        await waitForBatchedUpdatesWithAct();

        await act(async () => {
            result.current();
            await waitForBatchedUpdates();
        });

        const onboarding = await getOnyxValue(ONYXKEYS.NVP_ONBOARDING);
        expect(onboarding?.reviewedWorkspaceSettings).toBeUndefined();
    });
});
