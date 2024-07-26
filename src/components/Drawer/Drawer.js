import * as React from "react";
import Box from "@mui/material/Box";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import MailIcon from "@mui/icons-material/Mail";
import dayjs from "dayjs";

export default function GraceDrawer({ open, patient, onClose }) {
  console.log({ patient });

  const [state, setState] = React.useState({
    top: false,
    left: false,
    bottom: false,
    right: false,
  });

  const toggleDrawer = (anchor, open) => (event) => {
    if (
      event &&
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }

    setState({ ...state, [anchor]: open });
  };

  const getDetails = () => (
    <Box sx={{ width: 350, paddingTop: 7 }} role="presentation">
      <List>
        <ListItem>
          <ListItemText primary="ID" secondary={patient.ID} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Name" secondary={patient.name} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Age" secondary={patient.age} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Gender" secondary={patient.gender} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Present Complaint"
            secondary={patient.complaint}
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Past History" secondary={patient.history} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Prescribed Remedy"
            secondary={patient.remedy}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Date of Consultation"
            secondary={dayjs(patient.date).format("DD-MMM-YYYY")}
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Generals" secondary={patient.generals} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Allergic History"
            secondary={patient.allergy}
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Place" secondary={patient.place} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Phone" secondary={patient.phone_number} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Remarks" secondary={patient.remarks} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Amount Collected" secondary={patient.amount} />
        </ListItem>
      </List>
      <Divider />
    </Box>
  );

  return (
    <div>
      <React.Fragment>
        <SwipeableDrawer
          anchor={"right"}
          open={open}
          onClose={onClose}
          onOpen={toggleDrawer("right", true)}
        >
          {getDetails()}
        </SwipeableDrawer>
      </React.Fragment>
    </div>
  );
}
