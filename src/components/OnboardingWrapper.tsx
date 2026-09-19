import useThemeStyles from '@hooks/useThemeStyles';

import React, {useState} from 'react';

import FocusTrapContainerElement from './FocusTrap/FocusTrapContainerElement';
import FocusTrapForScreens from './FocusTrap/FocusTrapForScreen';
import {useOnboardingStickyHeaderElement} from './OnboardingStickyHeader';

type OnboardingWrapperProps = {
    children: React.ReactNode;
};

function OnboardingWrapper({children}: OnboardingWrapperProps) {
    const styles = useThemeStyles();
    const stickyHeaderElement = useOnboardingStickyHeaderElement();
    const [stepElement, setStepElement] = useState<HTMLElement | null>(null);

    // The sticky back header is drawn over the stack, outside this step, so it joins the step's focus trap first to stay reachable with Tab before the step content
    const containerElements = [stickyHeaderElement, stepElement].filter((element) => !!element);

    return (
        <FocusTrapForScreens focusTrapSettings={{containerElements}}>
            <FocusTrapContainerElement
                onContainerElementChanged={setStepElement}
                style={styles.h100}
            >
                {children}
            </FocusTrapContainerElement>
        </FocusTrapForScreens>
    );
}

export default OnboardingWrapper;
