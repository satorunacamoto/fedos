# FedOS Desktop Beta — Invitation and Chat Guide

Requires at least one configured Relay (see the Relay Setup Guide).

## Inviting a contact

1. On the **Conversations** screen, find your own account's public
   identity (visible under the "Profile unlocked" details at the top of
   the Ready screen).
2. Share that identifier with your contact through any channel you both
   trust (this app does not send it for you).
3. To invite them, enter **their** public identifier in "Contact's public
   identifier" and click **Send invitation**.

There is no code for your contact to paste, and no button for them to
click to "accept." A conversation is created and a real, signed invitation
is delivered over your configured Relay. Your contact's own conversation
list updates automatically the next time their own app is unlocked and
connected — this is by design, not a missing feature.

## Chatting

1. Click **Open** on a conversation in your list.
2. Type your message and press Enter (or click **Send**).
3. Messages from others arrive automatically while the conversation is
   open (checked periodically in the background). A message that has not
   been read yet shows a **Show message** button — click it to decrypt and
   display that one message. Messages are never bulk-decrypted.
4. Delivery state shown for a message you sent means it was durably
   written locally — it is not proof your contact has received or read it.

## Multiple conversations with the same person

You can have more than one separate conversation with the same contact;
each is tracked and isolated independently.
