import React, {useEffect, useRef} from 'react';
import InteractiveStepWrapper from '@components/InteractiveStepWrapper';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useSubStep from '@hooks/useSubStep';
import type {SubStepProps} from '@hooks/useSubStep/types';
import {getLatestErrorMessage} from '@libs/ErrorUtils';
import {formatE164PhoneNumber} from '@libs/LoginUtils';
import {getCurrentAddress, getStreetLines} from '@libs/PersonalDetailsUtils';
import Navigation from '@navigation/Navigation';
import {addPersonalBankAccount} from '@userActions/BankAccounts';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Address from './substeps/AddressStep';
import Confirmation from './substeps/ConfirmationStep';
import LegalName from './substeps/LegalNameStep';
import ManualBankAccountDetails from './substeps/ManualBankAccountDetailsStep';
import PhoneNumber from './substeps/PhoneNumberStep';
import PlaidBankAccount from './substeps/PlaidBankAccountStep';
import getSkippedStepsPersonalInfo from './utils/getSkippedStepsPersonalInfo';

const bodyContentInfoSet: Array<React.ComponentType<SubStepProps>> = [LegalName, Address, PhoneNumber, Confirmation];
const bodyContentWithPlaid: Array<React.ComponentType<SubStepProps>> = [PlaidBankAccount, ...bodyContentInfoSet];
const bodyContentWithManualSetup: Array<React.ComponentType<SubStepProps>> = [ManualBankAccountDetails, ...bodyContentInfoSet];

const DEFAULT_OBJECT = {};
const ACCOUNT_OWNERSHIP_ERROR_SUBSTRING = 'account ownership';

function PersonalInfoPage() {
    const {translate} = useLocalize();

    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);
    const [personalBankAccount] = useOnyx(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM_DRAFT);
    const [fullPersonalBankAccount] = useOnyx(ONYXKEYS.PERSONAL_BANK_ACCOUNT);
    const isManual = personalBankAccount?.setupType === CONST.BANK_ACCOUNT.SETUP_TYPE.MANUAL;
    const error = getLatestErrorMessage(fullPersonalBankAccount ?? DEFAULT_OBJECT);
    const confirmedOwnershipDetails = useRef(false);
    const [countryCode = CONST.DEFAULT_COUNTRY_CODE] = useOnyx(ONYXKEYS.COUNTRY_CODE);
    const [personalPolicyID] = useOnyx(ONYXKEYS.PERSONAL_POLICY_ID);

    const [plaidData] = useOnyx(ONYXKEYS.PLAID_DATA);

    const submitBankAccountForm = () => {
        const bankAccounts = plaidData?.bankAccounts ?? [];

        const selectedPlaidBankAccount = bankAccounts.find((bankAccount) => bankAccount.plaidAccountID === personalBankAccount?.selectedPlaidAccountID);
        const bankAccountWithToken = selectedPlaidBankAccount?.plaidAccessToken
            ? selectedPlaidBankAccount
            : {
                  ...selectedPlaidBankAccount,
                  plaidAccessToken: plaidData?.plaidAccessToken ?? '',
              };
        const finalPhoneNumber = personalBankAccount?.phoneNumber ?? privatePersonalDetails?.phoneNumber ?? '';
        // `privatePersonalDetails` keeps the address nested in `addresses[]`, not as flat `addressStreet/City/State/ZipCode`
        // keys, so spreading it doesn't supply an address. When the Address substep is skipped (the profile already has a
        // complete address), the form draft has no address either, so we'd create the account without one - which then
        // surfaces a "Review" badge. Fall back to the current profile address; draft values still win when edited in-flow.
        const currentAddress = getCurrentAddress(privatePersonalDetails);
        const [profileStreet1, profileStreet2] = getStreetLines(currentAddress?.street);
        const accountData = {
            ...privatePersonalDetails,
            ...personalBankAccount,
            ...bankAccountWithToken,
            phoneNumber: formatE164PhoneNumber(finalPhoneNumber, countryCode),
            addressStreet: personalBankAccount?.addressStreet ?? profileStreet1,
            addressStreet2: personalBankAccount?.addressStreet2 ?? currentAddress?.street2 ?? profileStreet2,
            addressCity: personalBankAccount?.addressCity ?? currentAddress?.city,
            addressState: personalBankAccount?.addressState ?? currentAddress?.state,
            addressZipCode: personalBankAccount?.addressZipCode ?? currentAddress?.zip,
            country: personalBankAccount?.country ?? currentAddress?.country,
        };
        if (confirmedOwnershipDetails.current) {
            accountData.confirmedOwnershipDetails = true;
        }
        addPersonalBankAccount(accountData, personalPolicyID);
    };

    const skipSteps = getSkippedStepsPersonalInfo(privatePersonalDetails);

    const {
        componentToRender: SubStep,
        isEditing,
        nextScreen,
        prevScreen,
        moveTo,
        screenIndex,
        goToTheLastStep,
    } = useSubStep({
        bodyContent: isManual ? bodyContentWithManualSetup : bodyContentWithPlaid,
        skipSteps,
        onFinished: submitBankAccountForm,
    });

    const handleBackButtonPress = () => {
        if (isEditing) {
            goToTheLastStep();
            return;
        }
        if (screenIndex === 0) {
            Navigation.goBack();
            return;
        }
        prevScreen();
    };

    useEffect(() => {
        if (!error) {
            return;
        }
        if (error.includes(ACCOUNT_OWNERSHIP_ERROR_SUBSTRING)) {
            confirmedOwnershipDetails.current = true;
        }
        return () => {
            confirmedOwnershipDetails.current = false;
        };
    }, [error]);

    return (
        <InteractiveStepWrapper
            wrapperID={PersonalInfoPage.displayName}
            headerTitle={translate('bankAccount.addBankAccount')}
            handleBackButtonPress={handleBackButtonPress}
        >
            <SubStep
                isEditing={isEditing}
                onNext={nextScreen}
                onMove={moveTo}
            />
        </InteractiveStepWrapper>
    );
}

PersonalInfoPage.displayName = 'PersonalInfoPage';

export default PersonalInfoPage;
