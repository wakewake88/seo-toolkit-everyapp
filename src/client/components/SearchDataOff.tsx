import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";

/** What a data screen shows while the search-data feature has no key. */
export function SearchDataOff() {
  return (
    <Alert data-testid="searchdata-off">
      <AlertTitle>Search data isn't set up</AlertTitle>
      <AlertDescription>
        A workspace admin turns on this app's Search data feature in the Gateway.
      </AlertDescription>
    </Alert>
  );
}
