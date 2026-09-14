import {fireEvent, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import {OnboardingStickyHeaderProvider, OnboardingStickyHeaderSpacer, useOnboardingStickyHeader} from '@components/OnboardingStickyHeader';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import Text from '@components/Text';

import type {NavigationContainerRef} from '@react-navigation/native';

import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import {View} from 'react-native';

import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

type ParamList = {
    First: undefined;
    Second: undefined;
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

function renderFlow(navigationRef: React.RefObject<NavigationContainerRef<ParamList> | null>) {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <NavigationContainer ref={navigationRef}>
                <OnboardingStickyHeaderProvider>
                    <Stack.Navigator
                        initialRouteName="First"
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
                    </Stack.Navigator>
                </OnboardingStickyHeaderProvider>
            </NavigationContainer>
        </ComposeProviders>,
    );
}

describe('OnboardingStickyHeader', () => {
    const backLabel = () => TestHelper.translateLocal('common.back');

    it('follows the focused step and renders the caret outside of the step', async () => {
        const navigationRef = React.createRef<NavigationContainerRef<ParamList>>();
        renderFlow(navigationRef);
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
});
