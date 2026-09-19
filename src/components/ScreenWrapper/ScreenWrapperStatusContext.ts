import {createContext} from 'react';

type ScreenWrapperStatusContextType = {
    didScreenTransitionEnd: boolean;
    isSafeAreaTopPaddingApplied: boolean;
    isSafeAreaBottomPaddingApplied: boolean;

    /** Whether the screen is shifted down by the visual viewport offset, which it does when `shouldEnableMaxHeight` is set */
    isViewportOffsetTopApplied?: boolean;
};

const ScreenWrapperStatusContext = createContext<ScreenWrapperStatusContextType | undefined>(undefined);

export default ScreenWrapperStatusContext;
