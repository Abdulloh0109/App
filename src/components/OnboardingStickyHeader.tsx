import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useThemeStyles from '@hooks/useThemeStyles';

import {useFocusEffect} from '@react-navigation/native';
import React, {createContext, useContext, useState} from 'react';
import {View} from 'react-native';

import CaretBackHeader from './CaretBackHeader';

type OnboardingStickyHeaderConfig = {
    /** Whether the focused step shows the back link */
    shouldShowBackButton: boolean;

    /** What the back link does for the focused step */
    onBackButtonPress?: () => void;
};

// Every initial onboarding step hides the back link, so start hidden to avoid a caret flash before the first step registers.
const DEFAULT_CONFIG: OnboardingStickyHeaderConfig = {shouldShowBackButton: false};

const SetOnboardingStickyHeaderConfigContext = createContext<React.Dispatch<React.SetStateAction<OnboardingStickyHeaderConfig>>>(() => {});

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
    const [config, setConfig] = useState<OnboardingStickyHeaderConfig>(DEFAULT_CONFIG);

    return (
        <SetOnboardingStickyHeaderConfigContext.Provider value={setConfig}>
            {config.shouldShowBackButton && (
                <View style={[styles.onboardingStickyHeader, styles.pointerEventsBoxNone, {paddingTop}]}>
                    <CaretBackHeader
                        onBackButtonPress={config.onBackButtonPress}
                        sentryLabel="OnboardingHeader-Back"
                    />
                </View>
            )}
            {children}
        </SetOnboardingStickyHeaderConfigContext.Provider>
    );
}

/** Keeps the room for the sticky header inside a step, so the step layout matches the header height exactly. */
function OnboardingStickyHeaderSpacer() {
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

export {OnboardingStickyHeaderProvider, OnboardingStickyHeaderSpacer, useOnboardingStickyHeader};
export type {OnboardingStickyHeaderConfig};
