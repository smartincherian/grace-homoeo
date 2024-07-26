import React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Menu from "@mui/material/Menu";
import { Link } from "react-router-dom";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import MenuIcon from "@mui/icons-material/Menu";
import { styled, useTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import "./Header.css";
import image from "../assets/logo.png";
import packageJson from "../../package.json";
import { Tooltip } from "@mui/material";

function Header(props) {
  {
    /* drawer begins */
  }
  const [open, setOpen] = React.useState(false);
  const handleDrawerOpen = () => {
    setOpen(true);
  };
  const handleDrawerClose = () => {
    setOpen(false);
  };
  const drawerWidth = 240;
  const theme = useTheme();
  const DrawerHeader = styled("div")(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
  }));

  {
    /* drawer ends */
  }

  return (
    <div>
      <AppBar
        position="fixed"
        style={{ background: "#150E56" }}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar variant="dense">
          {/* <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{ mr: 2, ...(open && { display: 'none' }) }}
                    >
                        <MenuIcon />
                    </IconButton> */}
          <Tooltip title={`v${packageJson?.version}` || ""}>
            <Box
              className="logo-box"
              component="img"
              sx={{
                height: "5vh",
                width: "5vw",
              }}
              alt="Your logo."
              src={image}
            />
          </Tooltip>

          <Typography variant="h6" component="div" sx={{ flexGrow: 17, pl: 2 }}>
            Grace Homoeo
          </Typography>

          <Typography variant="h6" component="div" sx={{ flexGrow: 17, pl: 2 }}>
            {props.page}
          </Typography>

          {/* UserIcon */}
          <IconButton
            size="large"
            // onClick={handleMenu}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1, pl: 2 }}>
            Dr. Brigitta Rinny
          </Typography>
        </Toolbar>
      </AppBar>

      {/* drawer begins */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          zIndex: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
        variant="permanent"
        anchor="left"
        open={open}
      >
        <Toolbar />

        {/* <DrawerHeader>
                    <IconButton onClick={handleDrawerClose}>
                        {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </DrawerHeader> */}
        <Divider />
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton className="listitem">
              <Link to="/" className="links">
                Home
              </Link>
            </ListItemButton>
          </ListItem>
        </List>
        <Divider />

        <List>
          <ListItem disablePadding>
            <ListItemButton>
              <Link to="/patientsManagement" className="links">
                Patient Management
              </Link>
            </ListItemButton>
          </ListItem>

          <div className="patients-drawer-items">
            <ListItem disablePadding>
              <ListItemButton>
                <Link to="/patientsAdd">Add New Patient</Link>
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton>
                <Link to="/patientsSearch">Search Existing Patient</Link>
              </ListItemButton>
            </ListItem>
          </div>

          <ListItem disablePadding>
            <ListItemButton>
              <Link to="/inventoryManagement" className="links">
                Inventory Management
              </Link>
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton>
              <Link to="/fundManagement" className="links">
                Fund Management
              </Link>
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      {/* Drawer ends */}
    </div>
  );
}

export default Header;
