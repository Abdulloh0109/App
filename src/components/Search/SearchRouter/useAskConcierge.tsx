import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useDelegateAccountID from '@hooks/useDelegateAccountID';
import useOnyx from '@hooks/useOnyx';
import useOpenConciergeAnywhere from '@hooks/useOpenConciergeAnywhere';
import useSidePanelReportID from '@hooks/useSidePanelReportID';

import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';

import {useConciergeSessionActions} from '@pages/inbox/ConciergeSessionContext';

import {addComment} from '@userActions/Report';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Returns a callback that opens the side panel (or Concierge chat on native)
 * and sends the provided search query as a message.
 * Also returns a flag indicating whether the Ask Concierge item is ready to be displayed.
 */
function useAskConcierge() {
    const sidePanelReportID = useSidePanelReportID();
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const {openConciergeAnywhere, isInSidePanel} = useOpenConciergeAnywhere();
    const targetReportID = (isInSidePanel ? sidePanelReportID : undefined) ?? conciergeReportID;
    const [targetReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(targetReportID)}`);
    const {timezone, accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const delegateAccountID = useDelegateAccountID();
    const {restartSession} = useConciergeSessionActions();
    const shouldShowAskConcierge = !!targetReportID && !!targetReport;

    const askConcierge = (searchQuery: string) => {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery || !shouldShowAskConcierge) {
            return;
        }
        // Without a side panel the question lands in the main Concierge DM, whose session boundary is only ever
        // created on open and can only be moved earlier afterwards — so an ask inside an active session inherits a
        // boundary that sits before the previous conversation and nothing gets hidden. Re-anchor it here, the way
        // openSidePanel does on every open, using the floor addComment stamps the question with so the existing
        // history sorts strictly before the boundary and the question at or after it. Kept out of
        // useOpenConciergeAnywhere on purpose: its other callers navigate without sending anything.
        if (!isInSidePanel) {
            restartSession(targetReport?.lastVisibleActionCreated);
        }
        openConciergeAnywhere();
        addComment({
            report: targetReport,
            notifyReportID: targetReportID,
            ancestors: [],
            text: trimmedQuery,
            timezoneParam: timezone ?? CONST.DEFAULT_TIME_ZONE,
            currentUserAccountID,
            shouldPlaySound: true,
            isInSidePanel,
            delegateAccountID,
            conciergeReportID,
        });
    };

    return {askConcierge, shouldShowAskConcierge};
}

export default useAskConcierge;
