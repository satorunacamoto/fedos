# FedOS Desktop Beta — Archive and Deletion Guide

## Exporting an Archive

1. Open **Archive**.
2. Enter the conversation id you want to export (visible on the
   Conversations screen under each conversation's own entry).
3. Click **Choose destination…** and pick where to save the file using
   the normal OS save dialog.
4. Click **Export**.

Exporting does not remove or invalidate your live, active encrypted
session with that contact — restoring the exported history later does not
automatically resume that live session; if you need to send again after a
restore, the app may need to re-establish the encrypted session first,
the same as starting a brand-new conversation would.

## Restoring an Archive

1. Open **Archive**, click **Choose archive file…**, and pick the file.
2. Click **Inspect manifest** to see a non-secret summary (which
   conversation, when it was exported, how many items) before restoring
   anything.
3. Enter the counterparty's public identifier (the same value shown when
   you message them).
4. Click **Restore**.

A Device that never received a related deletion/suppression fact from you
is not covered by this restore's own retention guarantees — restoring the
same Archive onto a different, out-of-sync Device may show content this
Device would otherwise have hidden.

## Signed Deletion

Open **Safety Center** to see any pending Signed Deletion requests sent to
you. Approving a request removes the local copy on your own Device — it
never guarantees removal from a Relay, from the requester's own Archive, or
from any other Device (yours or theirs). This policy always requires your
own explicit review; nothing is approved automatically.
