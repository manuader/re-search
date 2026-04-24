"use client";

import type { ToolParam } from "@/lib/apify/tool-schema";
import { TextInput } from "./text-input";
import { NumberInput } from "./number-input";
import { BooleanInput } from "./boolean-input";
import { EnumInput } from "./enum-input";
import { MultiEnumInput } from "./multi-enum-input";
import { DateRangeInput } from "./date-range-input";
import { KeywordListInput } from "./keyword-list-input";
import { GeoInput } from "./geo-input";
import { DateDistributionInput } from "./date-distribution-input";

export interface ParamInputProps {
  param: ToolParam;
  value: unknown;
  onChange: (value: unknown) => void;
  locale: string;
  error?: string;
  disabled?: boolean;
}

export function ParamInput(props: ParamInputProps) {
  switch (props.param.kind) {
    case "text":
      return <TextInput {...props} />;
    case "number":
      return <NumberInput {...props} />;
    case "boolean":
      return <BooleanInput {...props} />;
    case "enum":
      return <EnumInput {...props} />;
    case "multi_enum":
      return <MultiEnumInput {...props} />;
    case "date_range":
      return <DateRangeInput {...props} />;
    case "keyword_list":
      return <KeywordListInput {...props} />;
    case "geo":
      return <GeoInput {...props} />;
    case "date_distribution":
      return <DateDistributionInput {...props} />;
    default:
      return <TextInput {...props} />;
  }
}
