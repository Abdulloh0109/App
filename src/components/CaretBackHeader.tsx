import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import variables from '@styles/variables';

import CONST from '@src/CONST';

import React from 'react';
import {View} from 'react-native';

import Icon from './Icon';
import {PressableWithoutFeedback} from './Pressable';
import Text from './Text';

type CaretBackHeaderProps = {
    /** Called when the back link is pressed */
    onBackButtonPress?: () => void;

    /** Whether to render the back link. The header keeps its height when the link is hidden. */
    shouldShowBackButton?: boolean;

    /** Sentry label for the back link */
    sentryLabel?: string;
};

/**
 * Popover-style back link: caret + "Back" label.
 * Matches the submenu back row used by PopoverMenu. It is not tied to onboarding and can be used by any modal flow.
 */
function CaretBackHeader({onBackButtonPress, shouldShowBackButton = true, sentryLabel = 'CaretBackHeader-Back'}: CaretBackHeaderProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const theme = useTheme();
    const icons = useMemoizedLazyExpensifyIcons(['BackArrow']);

    return (
        <View style={[styles.onboardingHeaderContainer]}>
            {shouldShowBackButton ? (
                <PressableWithoutFeedback
                    onPress={onBackButtonPress}
                    style={[styles.flexRow, styles.alignItemsCenter, styles.gap3]}
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={translate('common.back')}
                    sentryLabel={sentryLabel}
                >
                    <Icon
                        src={icons.BackArrow}
                        fill={theme.icon}
                        width={variables.iconSizeNormal}
                        height={variables.iconSizeNormal}
                    />
                    <Text style={styles.createMenuHeaderText}>{translate('common.back')}</Text>
                </PressableWithoutFeedback>
            ) : null}
        </View>
    );
}

export default CaretBackHeader;
export type {CaretBackHeaderProps};
