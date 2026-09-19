import {fireEvent, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import {OnboardingStickyHeaderProvider, OnboardingStickyHeaderSpacer, useOnboardingStickyHeader} from '@components/OnboardingStickyHeader';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';

import ONYXKEYS from '@src/ONYXKEYS';

import type {NavigationContainerRef} from '@react-navigation/native';

import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import {View} from 'react-native';
import Onyx from 'react-native-onyx';

import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

// The visual viewport offset only exists on mobile web (e.g. iOS Safari with the keyboard open), so it's faked here
const mockViewportOffsetTop = 19;
jest.mock('@hooks/useViewportOffsetTop', () => ({
    __esModule: true,
    default: () => mockViewportOffsetTop,
}));

type ParamList = {
    First: undefined;
    Second: undefined;
    WithMaxHeight: undefined;
    WithoutMaxHeight: undefined;
};

const Stack = createStackNavigator<ParamList>();
const onSecondBack = jest.fn();

function FirstStep() {
    useOnboardingStickyHeader({shouldShowBackButton: false});
    return (
        <View testID="FirstStep">
            <OnboardingStickyHeaderSpacer />
            <Text>First</Text>
        </View>
    );
}

function SecondStep() {
    useOnboardingStickyHeader({shouldShowBackButton: true, onBackButtonPress: onSecondBack});
    return (
        <View testID="SecondStep">
            <OnboardingStickyHeaderSpacer />
            <Text>Second</Text>
        </View>
    );
}

function WithMaxHeightStep() {
    useOnboardingStickyHeader({shouldShowBackButton: true});
    return (
        <ScreenWrapper
            testID="WithMaxHeightStep"
            shouldEnableMaxHeight
        >
            <OnboardingStickyHeaderSpacer />
        </ScreenWrapper>
    );
}

function WithoutMaxHeightStep() {
    useOnboardingStickyHeader({shouldShowBackButton: true});
    return (
        <ScreenWrapper testID="WithoutMaxHeightStep">
            <OnboardingStickyHeaderSpacer />
        </ScreenWrapper>
    );
}

function renderFlow(navigationRef: React.RefObject<NavigationContainerRef<ParamList> | null>, initialRouteName: keyof ParamList) {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <NavigationContainer ref={navigationRef}>
                <OnboardingStickyHeaderProvider>
                    <Stack.Navigator
                        initialRouteName={initialRouteName}
                        screenOptions={{headerShown: false, animation: 'none'}}
                    >
                        <Stack.Screen
                            name="First"
                            component={FirstStep}
                        />
                        <Stack.Screen
                            name="Second"
                            component={SecondStep}
                        />
                        <Stack.Screen
                            name="WithMaxHeight"
                            component={WithMaxHeightStep}
                        />
                        <Stack.Screen
                            name="WithoutMaxHeight"
                            component={WithoutMaxHeightStep}
                        />
                    </Stack.Navigator>
                </OnboardingStickyHeaderProvider>
            </NavigationContainer>
        </ComposeProviders>,
    );
}

describe('OnboardingStickyHeader', () => {
    const backLabel = () => TestHelper.translateLocal('common.back');

    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    it('follows the focused step and renders the caret outside of the step', async () => {
        const navigationRef = React.createRef<NavigationContainerRef<ParamList>>();
        renderFlow(navigationRef, 'First');
        await waitForBatchedUpdatesWithAct();

        // The first step hides the caret
        expect(screen.queryByLabelText(backLabel())).not.toBeOnTheScreen();

        navigationRef.current?.navigate('Second');
        await waitForBatchedUpdatesWithAct();

        // The second step shows it, and it is rendered by the shared header rather than inside the step
        expect(screen.getByLabelText(backLabel())).toBeOnTheScreen();
        expect(screen.getByTestId('SecondStep')).not.toContainElement(screen.getByLabelText(backLabel()));

        fireEvent.press(screen.getByLabelText(backLabel()));
        expect(onSecondBack).toHaveBeenCalledTimes(1);

        // Going back, the first step takes focus again and the leaving step can't leave its caret behind
        navigationRef.current?.goBack();
        await waitForBatchedUpdatesWithAct();
        expect(screen.queryByLabelText(backLabel())).not.toBeOnTheScreen();
    });

    it('moves with the visual viewport offset only when the focused step is moved by it', async () => {
        const navigationRef = React.createRef<NavigationContainerRef<ParamList>>();
        renderFlow(navigationRef, 'WithMaxHeight');
        await waitForBatchedUpdatesWithAct();

        // A step with shouldEnableMaxHeight is shifted down by the offset, so the caret follows it
        expect(screen.getByTestId('OnboardingStickyHeader')).toHaveStyle({top: mockViewportOffsetTop});

        navigationRef.current?.navigate('WithoutMaxHeight');
        await waitForBatchedUpdatesWithAct();

        // A step without it scrolls with the page instead, so the caret stays at the top of the stack
        expect(screen.getByTestId('OnboardingStickyHeader')).toHaveStyle({top: 0});

        navigationRef.current?.goBack();
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByTestId('OnboardingStickyHeader')).toHaveStyle({top: mockViewportOffsetTop});
    });
});
