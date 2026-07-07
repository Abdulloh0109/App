import type {SearchTextFilterKeys} from '@components/Search/types';

import useLocalize from '@hooks/useLocalize';

import {isValidInputLength} from '@libs/ValidationUtils';

import CONST from '@src/CONST';

import {useEffect, useEffectEvent} from 'react';

const FILTER_MAX_LENGTH: Partial<Record<SearchTextFilterKeys, number>> = {
    [CONST.SEARCH.SYNTAX_FILTER_KEYS.DESCRIPTION]: CONST.DESCRIPTION_LIMIT,
    [CONST.SEARCH.SYNTAX_FILTER_KEYS.MERCHANT]: CONST.MERCHANT_NAME_MAX_BYTES,
    [CONST.SEARCH.SYNTAX_FILTER_KEYS.TITLE]: CONST.TASK_TITLE_CHARACTER_LIMIT,
};

function useTextFilterValidation(filterKey: SearchTextFilterKeys, value: string | undefined, onError?: (error: string | undefined) => void) {
    const {translate} = useLocalize();
    // Fall back to SEARCH_QUERY_LIMIT, not MAX_COMMENT_LENGTH: 15000 exceeds both the whole-query cap and the
    // native input limit, so the error was never reachable for keyword/reportID/withdrawal/report-field filters.
    const maxLength = FILTER_MAX_LENGTH[filterKey] ?? CONST.SEARCH_QUERY_LIMIT;
    const {isValid, byteLength} = isValidInputLength(value?.trim() ?? '', maxLength);
    const error = !isValid ? translate('common.error.characterLimitExceedCounter', byteLength, maxLength) : undefined;

    const onErrorCallback = useEffectEvent((err?: string) => onError?.(err));

    useEffect(() => {
        onErrorCallback(error);
    }, [error]);

    useEffect(() => () => onErrorCallback(), []);

    return error;
}

export default useTextFilterValidation;
