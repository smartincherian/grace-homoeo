import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Tooltip,
  Collapse,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircle from "@mui/icons-material/AccountCircle";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import image from "../assets/logo.png";
import packageJson from "../../package.json";
import "./Header.css";

function Header(props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [patientSubMenuOpen, setPatientSubMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const userMenuOpen = Boolean(anchorEl);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
    setPatientSubMenuOpen(!patientSubMenuOpen);
  };
  const handleUserMenu = (e) => setAnchorEl(e.currentTarget);
  const handleUserMenuClose = () => setAnchorEl(null);
  const togglePatientSubMenu = () => setPatientSubMenuOpen(!patientSubMenuOpen);

  const drawerWidth = 240;

  const drawerContent = (
    <>
      <Box display="flex" justifyContent="flex-end" p={1}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <List disablePadding>
        <ListItem disablePadding>
          <ListItemButton onClick={handleDrawerToggle} component={Link} to="/">
            Home
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton onClick={togglePatientSubMenu}>
            Patient Management
          </ListItemButton>
        </ListItem>

        <Collapse in={patientSubMenuOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                sx={{ pl: 4 }}
                onClick={handleDrawerToggle}
                component={Link}
                to="/patientsAdd"
              >
                Add New Patient
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                sx={{ pl: 4 }}
                onClick={handleDrawerToggle}
                component={Link}
                to="/consultationAdd"
              >
                Add New Consultation
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding>
              <ListItemButton
                sx={{ pl: 4 }}
                onClick={handleDrawerToggle}
                component={Link}
                to="/patientsSearch"
              >
                Search Existing Patientss
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>

        <ListItem disablePadding>
          <ListItemButton
            onClick={handleDrawerToggle}
            component={Link}
            to="/inventoryManagement"
          >
            Inventory Management
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleDrawerToggle}
            component={Link}
            to="/fundManagement"
          >
            Fund Management
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );

  return (
    <div>
      <AppBar
        position="fixed"
        style={{ background: "#150E56" }}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar variant="dense">
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Tooltip title={`v${packageJson?.version}` || ""}>
            <Box
              component="img"
              sx={{
                height: isMobile ? "4vh" : "5vh",
                width: "auto",
                maxWidth: isMobile ? "10vw" : "5vw",
              }}
              alt="Logo"
              src={image}
            />
          </Tooltip>

          <Typography
            variant={isMobile ? "subtitle1" : "h6"}
            component="div"
            sx={{ pl: 1, flexGrow: 1 }}
          >
            Grace Homoeo
          </Typography>

          {!isMobile && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Link to="/" className="links">
                <Typography variant="button" color="inherit">
                  Home
                </Typography>
              </Link>

              <Box sx={{ position: "relative" }}>
                <Typography
                  variant="button"
                  color="inherit"
                  onClick={togglePatientSubMenu}
                  sx={{ cursor: "pointer" }}
                >
                  Patient Management
                </Typography>
                <Collapse in={patientSubMenuOpen} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      position: "absolute",
                      backgroundColor: "white",
                      color: "black",
                      p: 1,
                      mt: 1,
                      boxShadow: 3,
                      borderRadius: 1,
                    }}
                  >
                    <Link to="/consultationAdd" className="links">
                      <Typography variant="body2">
                        Add New Consultation
                      </Typography>
                    </Link>
                    <Link to="/patientsAdd" className="links">
                      <Typography variant="body2">Add New Patient</Typography>
                    </Link>
                    {/* <Link to="/patientsSearch" className="links">
                      <Typography variant="body2">
                        Search Existing Patientss
                      </Typography>
                    </Link> */}
                  </Box>
                </Collapse>
              </Box>

              <Link to="/inventoryManagement" className="links">
                <Typography variant="button" color="inherit">
                  Inventory
                </Typography>
              </Link>
              <Link to="/fundManagement" className="links">
                <Typography variant="button" color="inherit">
                  Funds
                </Typography>
              </Link>
            </Box>
          )}

          <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
            <IconButton size="large" onClick={handleUserMenu} color="inherit">
              <AccountCircle />
            </IconButton>
            <Typography
              variant={isMobile ? "body2" : "h6"}
              sx={{ pl: 1, display: isMobile ? "none" : "block" }}
            >
              Dr. Brigitta Rinny
            </Typography>
          </Box>

          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={userMenuOpen}
            onClose={handleUserMenuClose}
          >
            <MenuItem onClick={handleUserMenuClose}>Profile</MenuItem>
            <MenuItem onClick={handleUserMenuClose}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </div>
  );
}

export default Header;
