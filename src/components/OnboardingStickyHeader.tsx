import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';

import {useFocusEffect} from '@react-navigation/native';
import React, {createContext, useContext, useState} from 'react';
import {View} from 'react-native';

import CaretBackHeader from './CaretBackHeader';
import FocusTrapContainerElement from './FocusTrap/FocusTrapContainerElement';
import ScreenWrapperStatusContext from './ScreenWrapper/ScreenWrapperStatusContext';

type OnboardingStickyHeaderConfig = {
    /** Whether the focused step shows the back link */
    shouldShowBackButton: boolean;

    /** What the back link does for the focused step */
    onBackButtonPress?: () => void;
};

// Every initial onboarding step hides the back link, so start hidden to avoid a caret flash before the first step registers.
const DEFAULT_CONFIG: OnboardingStickyHeaderConfig = {shouldShowBackButton: false};

const SetOnboardingStickyHeaderConfigContext = createContext<React.Dispatch<React.SetStateAction<OnboardingStickyHeaderConfig>>>(() => {});

// Whether the focused step is shifted down by the visual viewport offset
const SetIsViewportOffsetTopAppliedContext = createContext<(isViewportOffsetTopApplied: boolean) => void>(() => {});

// The header element on web, so the focused step can add it to its focus trap
const OnboardingStickyHeaderElementContext = createContext<HTMLElement | null>(null);

/**
 * Renders one back header for the whole onboarding stack.
 *
 * The header is an overlay on top of the stack instead of a row above it. Each step still reserves the same strip with
 * OnboardingStickyHeaderSpacer, so the screens keep exactly the size and position they have without the sticky header.
 * That keeps ScreenWrapper's keyboard avoidance, max height and safe area padding working as before on every platform,
 * while the caret itself lives outside the animated cards and never moves during a transition.
 */
function OnboardingStickyHeaderProvider({children}: {children: React.ReactNode}) {
    const styles = useThemeStyles();
    const {paddingTop} = useSafeAreaPaddings();
    const viewportOffsetTop = useViewportOffsetTop();
    const [config, setConfig] = useState<OnboardingStickyHeaderConfig>(DEFAULT_CONFIG);
    const [isViewportOffsetTopApplied, setIsViewportOffsetTopApplied] = useState(false);
    const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);

    return (
        <SetOnboardingStickyHeaderConfigContext.Provider value={setConfig}>
            <SetIsViewportOffsetTopAppliedContext.Provider value={setIsViewportOffsetTopApplied}>
                <OnboardingStickyHeaderElementContext.Provider value={headerElement}>
                    {/* The host is a child of the navigator content wrapper, so the header gets the same side insets as the steps (e.g. the Dynamic Island in iOS landscape) */}
                    <View style={styles.flex1}>
                        {config.shouldShowBackButton && (
                            <View
                                testID="OnboardingStickyHeader"
                                style={[styles.onboardingStickyHeader, styles.pointerEventsBoxNone, {paddingTop, top: isViewportOffsetTopApplied ? viewportOffsetTop : 0}]}
                            >
                                <FocusTrapContainerElement onContainerElementChanged={setHeaderElement}>
                                    <CaretBackHeader
                                        onBackButtonPress={config.onBackButtonPress}
                                        sentryLabel="OnboardingHeader-Back"
                                    />
                                </FocusTrapContainerElement>
                            </View>
                        )}
                        {children}
                    </View>
                </OnboardingStickyHeaderElementContext.Provider>
            </SetIsViewportOffsetTopAppliedContext.Provider>
        </SetOnboardingStickyHeaderConfigContext.Provider>
    );
}

/** Keeps the room for the sticky header inside a step, so the step layout matches the header height exactly. */
function OnboardingStickyHeaderSpacer() {
    const setIsViewportOffsetTopApplied = useContext(SetIsViewportOffsetTopAppliedContext);
    const screenWrapperStatus = useContext(ScreenWrapperStatusContext);
    const isViewportOffsetTopApplied = !!screenWrapperStatus?.isViewportOffsetTopApplied;

    // On mobile web with the keyboard open, a step is shifted down by the visual viewport offset only when its ScreenWrapper applies it,
    // so the header follows the focused step to stay exactly over this strip.
    useFocusEffect(() => {
        setIsViewportOffsetTopApplied(isViewportOffsetTopApplied);
    });

    return <CaretBackHeader shouldShowBackButton={false} />;
}

/**
 * Registers the back link config of the step while it is focused. The step keeps its own visibility rule and back
 * target, only the rendering moves to the sticky header.
 */
function useOnboardingStickyHeader({shouldShowBackButton, onBackButtonPress}: OnboardingStickyHeaderConfig) {
    const setConfig = useContext(SetOnboardingStickyHeaderConfigContext);

    useFocusEffect(() => {
        const registeredConfig: OnboardingStickyHeaderConfig = {shouldShowBackButton, onBackButtonPress};
        setConfig(registeredConfig);

        // Only reset when nothing newer was registered, so a step that is leaving can't clear the config of the step taking focus.
        return () => setConfig((currentConfig) => (currentConfig === registeredConfig ? DEFAULT_CONFIG : currentConfig));
    });
}

/** The sticky header element on web, or null when the back link is hidden or on native */
function useOnboardingStickyHeaderElement() {
    return useContext(OnboardingStickyHeaderElementContext);
}

export {OnboardingStickyHeaderProvider, OnboardingStickyHeaderSpacer, useOnboardingStickyHeader, useOnboardingStickyHeaderElement};
export type {OnboardingStickyHeaderConfig};
